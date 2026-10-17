const express = require("express");
const fs = require("fs");
const { pool } = require("../db");
const config = require("../config");
const { asyncHandler } = require("../utils/helpers");
const { requireAuth, requireKyc, optionalAuth } = require("../middleware/auth");
const { imgUpload, ownershipUpload, registerUpload } = require("../middleware/upload");
const { sha256 } = require("../utils/hash");
const chain = require("../services/chain");

const router = express.Router();

/** Public URL for a stored property photo. */
function imageUrl(propertyId, imageId) {
  return `${config.publicApiUrl}/api/properties/${propertyId}/images/${imageId}`;
}

/**
 * Reusable SELECT that joins the owner (name + phone) and aggregates the
 * property's photos so every serialized property carries its image list.
 */
const PROPERTY_SELECT = `
  SELECT p.*, u.full_name AS owner_name, u.phone AS owner_phone,
         EXISTS (SELECT 1 FROM property_documents pd WHERE pd.property_id = p.id)
           AS has_ownership_docs,
         COALESCE(
           (SELECT json_agg(json_build_object('id', pi.id, 'fileName', pi.file_name)
                            ORDER BY pi.sort_order, pi.id)
              FROM property_images pi
             WHERE pi.property_id = p.id),
           '[]'::json
         ) AS images
    FROM properties p
    JOIN users u ON u.id = p.owner_id`;

function serializeProperty(p) {
  if (!p) return null;
  const images = (p.images || []).map((img) => ({
    id: img.id,
    fileName: img.fileName,
    url: imageUrl(p.id, img.id),
  }));
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    location: p.location,
    propertyType: p.property_type,
    areaSqft: p.area_sqft,
    ownerId: p.owner_id,
    ownerWallet: p.owner_wallet,
    ownerName: p.owner_name || null,
    ownerPhone: p.owner_phone || null,
    status: p.status,
    price: p.price,
    nftTokenId: p.nft_token_id,
    metadataUri: p.metadata_uri,
    mintTxHash: p.mint_tx_hash,
    rejectReason: p.reject_reason,
    images,
    coverImage: images.length ? images[0].url : null,
    hasOwnershipDocs: !!p.has_ownership_docs,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

function serializeHistory(h) {
  return {
    id: h.id,
    propertyId: h.property_id,
    ownerId: h.owner_id,
    ownerWallet: h.owner_wallet,
    ownerName: h.owner_name || null,
    ownerPhone: h.owner_phone || null,
    price: h.price,
    txHash: h.tx_hash,
    startedAt: h.started_at,
    endedAt: h.ended_at,
  };
}

/** Persist uploaded photo rows for a property (off-chain files, DB metadata). */
async function saveImages(propertyId, files) {
  const list = files || [];
  if (!list.length) return;
  const { rows } = await pool.query(
    "SELECT COALESCE(MAX(sort_order), -1) AS max FROM property_images WHERE property_id = $1",
    [propertyId]
  );
  let order = Number(rows[0].max) + 1;
  for (const file of list) {
    const fileHash = sha256(fs.readFileSync(file.path));
    await pool.query(
      `INSERT INTO property_images (property_id, file_name, file_path, file_hash, sort_order)
       VALUES ($1, $2, $3, $4, $5)`,
      [propertyId, file.originalname, file.path, fileHash, order++]
    );
  }
}

/** Persist ownership-document rows (off-chain files, DB metadata). */
async function saveOwnershipDocs(propertyId, userId, files) {
  for (const file of files || []) {
    const fileHash = sha256(fs.readFileSync(file.path));
    await pool.query(
      `INSERT INTO property_documents (property_id, file_name, file_path, file_hash, uploaded_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [propertyId, file.originalname, file.path, fileHash, userId]
    );
  }
}

function serializeOwnershipDoc(d) {
  return {
    id: d.id,
    propertyId: d.property_id,
    fileName: d.file_name,
    fileHash: d.file_hash,
    docType: d.doc_type || null,
    uploadedAt: d.created_at,
  };
}

/**
 * Ownership documents are private. They may be seen by the property's owner,
 * the government, or a buyer whose purchase request has been accepted.
 */
async function canViewOwnershipDocs(user, property) {
  if (!user) return false;
  if (user.role === "government") return true;
  if (user.wallet_address === property.owner_wallet) return true;

  const { rows } = await pool.query(
    `SELECT 1 FROM requests
      WHERE property_id = $1 AND buyer_wallet = $2
        AND status IN ('Accepted', 'GovApproved', 'Paid')
      LIMIT 1`,
    [property.id, user.wallet_address]
  );
  return rows.length > 0;
}

/**
 * Public marketplace: only properties that are actually listed for sale.
 * Unlisted (verified/pending/minted) properties are reachable from their own
 * page and from the owner's "My Properties", but not from the marketplace.
 */
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const { rows } = await pool.query(
      `${PROPERTY_SELECT}
        WHERE p.status = 'listed'
        ORDER BY p.created_at DESC`
    );
    res.json({ properties: rows.map(serializeProperty) });
  })
);

/**
 * Properties owned by the logged-in user (any status).
 */
router.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `${PROPERTY_SELECT}
        WHERE p.owner_wallet = $1
        ORDER BY p.created_at DESC`,
      [req.user.wallet_address]
    );
    res.json({ properties: rows.map(serializeProperty) });
  })
);

/**
 * Register (submit) a new property. Requires approved KYC.
 * Status starts as 'pending' until the government verifies and mints it.
 */
router.post(
  "/",
  requireAuth,
  requireKyc,
  registerUpload,
  asyncHandler(async (req, res) => {
    const { title, description, location, propertyType, areaSqft } = req.body;
    if (!title || !location) {
      return res.status(400).json({ error: "Title and location are required." });
    }

    // Ownership proof is submitted together with the property.
    const documents = (req.files && req.files.documents) || [];
    if (!documents.length) {
      return res.status(400).json({
        error: "Please attach at least one ownership document (e.g. land certificate).",
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO properties
         (title, description, location, property_type, area_sqft, owner_id, owner_wallet, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [
        title,
        description || null,
        location,
        propertyType || null,
        areaSqft || null,
        req.user.id,
        req.user.wallet_address,
      ]
    );

    // Store the uploaded photos and ownership documents, then return the
    // property with its image list.
    await saveImages(rows[0].id, (req.files && req.files.images) || []);
    await saveOwnershipDocs(rows[0].id, req.user.id, documents);
    const full = await pool.query(`${PROPERTY_SELECT} WHERE p.id = $1`, [rows[0].id]);

    res.status(201).json({
      message: "Property submitted for government verification.",
      property: serializeProperty(full.rows[0]),
    });
  })
);

/**
 * Property detail with full ownership history.
 */
router.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(`${PROPERTY_SELECT} WHERE p.id = $1`, [req.params.id]);
    const property = rows[0];
    if (!property) return res.status(404).json({ error: "Property not found." });

    const history = await pool.query(
      `SELECT h.*, u.full_name AS owner_name, u.phone AS owner_phone
         FROM ownership_history h
         LEFT JOIN users u ON u.id = h.owner_id
        WHERE h.property_id = $1
        ORDER BY h.started_at ASC`,
      [req.params.id]
    );

    // Ownership documents are only exposed to authorised viewers (owner,
    // government, or an accepted buyer). Others just see that they exist.
    let ownershipDocs = null;
    if (await canViewOwnershipDocs(req.user, property)) {
      const docs = await pool.query(
        "SELECT * FROM property_documents WHERE property_id = $1 ORDER BY created_at, id",
        [property.id]
      );
      ownershipDocs = docs.rows.map(serializeOwnershipDoc);
    }

    res.json({
      property: serializeProperty(property),
      history: history.rows.map(serializeHistory),
      ownershipDocs,
    });
  })
);

/**
 * ERC721 metadata endpoint. Used as the tokenURI when minting.
 */
router.get(
  "/:id/metadata",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM properties WHERE id = $1", [req.params.id]);
    const p = rows[0];
    if (!p) return res.status(404).json({ error: "Property not found." });

    // Use the first photo as the NFT image in the metadata.
    const img = await pool.query(
      "SELECT id FROM property_images WHERE property_id = $1 ORDER BY sort_order, id LIMIT 1",
      [p.id]
    );

    res.json({
      name: p.title,
      description: p.description,
      image: img.rows[0] ? imageUrl(p.id, img.rows[0].id) : undefined,
      external_url: `${config.publicApiUrl}/api/properties/${p.id}`,
      attributes: [
        { trait_type: "Location", value: p.location },
        { trait_type: "Property Type", value: p.property_type || "N/A" },
        { trait_type: "Area (sqft)", value: p.area_sqft || "N/A" },
        { trait_type: "Token ID", value: p.nft_token_id },
      ],
    });
  })
);

/**
 * Record a listing after the seller lists on-chain through MetaMask.
 * The frontend sends the price and the transaction hash; we verify it.
 */
router.patch(
  "/:id/list",
  requireAuth,
  requireKyc,
  asyncHandler(async (req, res) => {
    const price = String(req.body.price || "");
    const { txHash } = req.body;
    if (!price || BigInt(price) <= 0n) {
      return res.status(400).json({ error: "A valid price is required." });
    }

    const { rows } = await pool.query("SELECT * FROM properties WHERE id = $1", [req.params.id]);
    const property = rows[0];
    if (!property) return res.status(404).json({ error: "Property not found." });
    if (property.owner_wallet !== req.user.wallet_address) {
      return res.status(403).json({ error: "You do not own this property." });
    }
    if (!["verified", "listed"].includes(property.status)) {
      return res.status(400).json({ error: "Property must be government-verified first." });
    }

    // Verify the on-chain listing transaction if one was provided.
    if (txHash) {
      await chain.assertSuccessfulTx(txHash, req.user.wallet_address);
      const listing = await chain.marketRead().listings(property.nft_token_id);
      if (!listing.active || listing.seller.toLowerCase() !== req.user.wallet_address) {
        return res.status(400).json({ error: "On-chain listing not found." });
      }
    }

    const updated = await pool.query(
      `UPDATE properties SET price = $1, status = 'listed', updated_at = NOW()
        WHERE id = $2 RETURNING *`,
      [price, property.id]
    );

    res.json({ message: "Property listed for sale.", property: serializeProperty(updated.rows[0]) });
  })
);

/**
 * Serve a property photo. Public - photos are part of the public listing.
 */
router.get(
  "/:id/images/:imageId",
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      "SELECT * FROM property_images WHERE id = $1 AND property_id = $2",
      [req.params.imageId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Image not found." });
    res.sendFile(rows[0].file_path);
  })
);

/**
 * Add photos to an existing property (owner only).
 */
router.post(
  "/:id/images",
  requireAuth,
  requireKyc,
  imgUpload.array("images", 6),
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM properties WHERE id = $1", [req.params.id]);
    const property = rows[0];
    if (!property) return res.status(404).json({ error: "Property not found." });
    if (property.owner_wallet !== req.user.wallet_address) {
      return res.status(403).json({ error: "You do not own this property." });
    }
    if (!req.files || !req.files.length) {
      return res.status(400).json({ error: "No images were uploaded." });
    }

    await saveImages(property.id, req.files);
    const full = await pool.query(`${PROPERTY_SELECT} WHERE p.id = $1`, [property.id]);
    res.status(201).json({ message: "Photos added.", property: serializeProperty(full.rows[0]) });
  })
);

/**
 * Delete a property photo (owner only).
 */
router.delete(
  "/:id/images/:imageId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM properties WHERE id = $1", [req.params.id]);
    const property = rows[0];
    if (!property) return res.status(404).json({ error: "Property not found." });
    if (property.owner_wallet !== req.user.wallet_address) {
      return res.status(403).json({ error: "You do not own this property." });
    }

    const img = await pool.query(
      "SELECT * FROM property_images WHERE id = $1 AND property_id = $2",
      [req.params.imageId, property.id]
    );
    if (!img.rows[0]) return res.status(404).json({ error: "Image not found." });

    await pool.query("DELETE FROM property_images WHERE id = $1", [img.rows[0].id]);
    fs.unlink(img.rows[0].file_path, () => {}); // best-effort file cleanup
    res.json({ message: "Photo removed." });
  })
);

/**
 * Upload ownership documents for a property (owner only).
 * At least one must exist before the property can be listed for sale.
 */
router.post(
  "/:id/ownership-docs",
  requireAuth,
  requireKyc,
  ownershipUpload.array("documents", 5),
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM properties WHERE id = $1", [req.params.id]);
    const property = rows[0];
    if (!property) return res.status(404).json({ error: "Property not found." });
    if (property.owner_wallet !== req.user.wallet_address) {
      return res.status(403).json({ error: "You do not own this property." });
    }
    if (!req.files || !req.files.length) {
      return res.status(400).json({ error: "No documents were uploaded." });
    }

    await saveOwnershipDocs(property.id, req.user.id, req.files);
    const docs = await pool.query(
      "SELECT * FROM property_documents WHERE property_id = $1 ORDER BY created_at, id",
      [property.id]
    );
    res.status(201).json({
      message: "Ownership documents uploaded.",
      ownershipDocs: docs.rows.map(serializeOwnershipDoc),
    });
  })
);

/** List ownership-document metadata (owner, government, or accepted buyer). */
router.get(
  "/:id/ownership-docs",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM properties WHERE id = $1", [req.params.id]);
    const property = rows[0];
    if (!property) return res.status(404).json({ error: "Property not found." });
    if (!(await canViewOwnershipDocs(req.user, property))) {
      return res.status(403).json({ error: "Ownership documents are not visible to you." });
    }
    const docs = await pool.query(
      "SELECT * FROM property_documents WHERE property_id = $1 ORDER BY created_at, id",
      [property.id]
    );
    res.json({ ownershipDocs: docs.rows.map(serializeOwnershipDoc) });
  })
);

/** Download an ownership document (access controlled). */
router.get(
  "/:id/ownership-docs/:docId",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM properties WHERE id = $1", [req.params.id]);
    const property = rows[0];
    if (!property) return res.status(404).json({ error: "Property not found." });
    if (!(await canViewOwnershipDocs(req.user, property))) {
      return res.status(403).json({ error: "Ownership documents are not visible to you." });
    }
    const doc = await pool.query(
      "SELECT * FROM property_documents WHERE id = $1 AND property_id = $2",
      [req.params.docId, property.id]
    );
    if (!doc.rows[0]) return res.status(404).json({ error: "Document not found." });
    res.download(doc.rows[0].file_path, doc.rows[0].file_name);
  })
);

/** Remove an ownership document (owner only). */
router.delete(
  "/:id/ownership-docs/:docId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query("SELECT * FROM properties WHERE id = $1", [req.params.id]);
    const property = rows[0];
    if (!property) return res.status(404).json({ error: "Property not found." });
    if (property.owner_wallet !== req.user.wallet_address) {
      return res.status(403).json({ error: "You do not own this property." });
    }
    const doc = await pool.query(
      "SELECT * FROM property_documents WHERE id = $1 AND property_id = $2",
      [req.params.docId, property.id]
    );
    if (!doc.rows[0]) return res.status(404).json({ error: "Document not found." });

    await pool.query("DELETE FROM property_documents WHERE id = $1", [doc.rows[0].id]);
    fs.unlink(doc.rows[0].file_path, () => {}); // best-effort file cleanup
    res.json({ message: "Document removed." });
  })
);

module.exports = router;
