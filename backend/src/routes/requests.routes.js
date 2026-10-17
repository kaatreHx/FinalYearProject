const express = require("express");
const fs = require("fs");
const { pool } = require("../db");
const { asyncHandler } = require("../utils/helpers");
const { requireAuth, requireKyc } = require("../middleware/auth");
const { docUpload } = require("../middleware/upload");
const { hashFiles, sha256 } = require("../utils/hash");
const chain = require("../services/chain");

const router = express.Router();

function serializeRequest(r) {
  if (!r) return null;
  return {
    id: r.id,
    propertyId: r.property_id,
    propertyTitle: r.property_title || null,
    buyerId: r.buyer_id,
    buyerWallet: r.buyer_wallet,
    buyerName: r.buyer_name || null,
    sellerWallet: r.seller_wallet,
    sellerName: r.seller_name || null,
    price: r.price,
    status: r.status,
    documentHash: r.document_hash,
    documentsVisibleToSeller: r.documents_visible_to_seller,
    onchainRequestId: r.onchain_request_id,
    createTxHash: r.create_tx_hash,
    acceptTxHash: r.accept_tx_hash,
    approveTxHash: r.approve_tx_hash,
    payTxHash: r.pay_tx_hash,
    rejectReason: r.reject_reason,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function loadRequest(id) {
  const { rows } = await pool.query(
    `SELECT r.*,
            p.title AS property_title,
            bu.full_name AS buyer_name,
            su.full_name AS seller_name
       FROM requests r
       JOIN properties p ON p.id = r.property_id
       JOIN users bu ON bu.id = r.buyer_id
       LEFT JOIN users su ON su.wallet_address = r.seller_wallet
      WHERE r.id = $1`,
    [id]
  );
  return rows[0];
}

function isParticipant(user, reqRow) {
  return (
    user.role === "government" ||
    user.wallet_address === reqRow.buyer_wallet ||
    user.wallet_address === reqRow.seller_wallet
  );
}

/** The two identity documents a buyer must attach to a purchase request. */
const REQUEST_DOC_FIELDS = [
  { name: "citizenship", maxCount: 1 },
  { name: "pan", maxCount: 1 },
];

/**
 * Buyer creates a purchase request and attaches their citizenship certificate
 * and PAN card. Documents are stored off-chain and stay hidden from the seller
 * until the seller accepts the request.
 */
router.post(
  "/",
  requireAuth,
  requireKyc,
  docUpload.fields(REQUEST_DOC_FIELDS),
  asyncHandler(async (req, res) => {
    const propertyId = req.body.propertyId;
    if (!propertyId) return res.status(400).json({ error: "propertyId is required." });

    const { rows } = await pool.query("SELECT * FROM properties WHERE id = $1", [propertyId]);
    const property = rows[0];
    if (!property) return res.status(404).json({ error: "Property not found." });
    if (property.status !== "listed") {
      return res.status(400).json({ error: "This property is not listed for sale." });
    }
    if (property.owner_wallet === req.user.wallet_address) {
      return res.status(400).json({ error: "You cannot request your own property." });
    }

    // Both identity documents are required.
    const uploaded = req.files || {};
    const citizenship = (uploaded.citizenship || [])[0];
    const pan = (uploaded.pan || [])[0];
    if (!citizenship || !pan) {
      // Remove anything already written to disk before rejecting.
      [citizenship, pan].filter(Boolean).forEach((f) => fs.unlink(f.path, () => {}));
      return res.status(400).json({
        error: "Please attach both your citizenship certificate and your PAN card.",
      });
    }
    const attachments = [
      { file: citizenship, docType: "citizenship" },
      { file: pan, docType: "pan" },
    ];
    const documentHash = hashFiles(attachments.map((a) => a.file));

    const inserted = await pool.query(
      `INSERT INTO requests
         (property_id, buyer_id, buyer_wallet, seller_wallet, price, status, document_hash, documents_visible_to_seller)
       VALUES ($1, $2, $3, $4, $5, 'Pending', $6, FALSE)
       RETURNING *`,
      [
        property.id,
        req.user.id,
        req.user.wallet_address,
        property.owner_wallet,
        property.price,
        documentHash,
      ]
    );

    for (const { file, docType } of attachments) {
      const fileHash = sha256(fs.readFileSync(file.path));
      await pool.query(
        `INSERT INTO documents (request_id, file_name, file_path, file_hash, doc_type, visible_to_seller)
         VALUES ($1, $2, $3, $4, $5, FALSE)`,
        [inserted.rows[0].id, file.originalname, file.path, fileHash, docType]
      );
    }

    res.status(201).json({
      message: "Purchase request created. Now confirm it on-chain with MetaMask.",
      request: serializeRequest(inserted.rows[0]),
      // Everything the frontend needs to call marketplace.createRequest()
      chain: {
        tokenId: property.nft_token_id,
        documentHash,
        price: property.price,
        sellerWallet: property.owner_wallet,
      },
    });
  })
);

/**
 * After the buyer calls createRequest on-chain, store the on-chain request id.
 */
router.patch(
  "/:id/onchain",
  requireAuth,
  asyncHandler(async (req, res) => {
    const request = await loadRequest(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found." });
    if (request.buyer_wallet !== req.user.wallet_address) {
      return res.status(403).json({ error: "Only the buyer can do this." });
    }

    const { onchainRequestId, txHash } = req.body;
    if (txHash) await chain.assertSuccessfulTx(txHash, req.user.wallet_address);

    await pool.query(
      "UPDATE requests SET onchain_request_id = $1, create_tx_hash = $2, updated_at = NOW() WHERE id = $3",
      [onchainRequestId || null, txHash || null, request.id]
    );

    res.json({ message: "Request linked on-chain.", request: serializeRequest(await loadRequest(request.id)) });
  })
);

/** Requests where the user is the buyer or the seller. */
router.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT r.*, p.title AS property_title,
              bu.full_name AS buyer_name, su.full_name AS seller_name
         FROM requests r
         JOIN properties p ON p.id = r.property_id
         JOIN users bu ON bu.id = r.buyer_id
         LEFT JOIN users su ON su.wallet_address = r.seller_wallet
        WHERE r.buyer_wallet = $1 OR r.seller_wallet = $1
        ORDER BY r.created_at DESC`,
      [req.user.wallet_address]
    );
    const requests = rows.map((r) => ({
      ...serializeRequest(r),
      role: r.buyer_wallet === req.user.wallet_address ? "buyer" : "seller",
    }));
    res.json({ requests });
  })
);

/** Request detail (participants and government only). */
router.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const request = await loadRequest(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found." });
    if (!isParticipant(req.user, request)) {
      return res.status(403).json({ error: "Not allowed." });
    }

    // Documents are only listed for the buyer, the government, or the seller
    // after the seller has accepted.
    const canSeeDocs =
      req.user.role === "government" ||
      request.buyer_wallet === req.user.wallet_address ||
      request.documents_visible_to_seller;

    let documents = [];
    if (canSeeDocs) {
      const docs = await pool.query(
        "SELECT id, file_name, file_hash, doc_type, visible_to_seller, uploaded_at FROM documents WHERE request_id = $1 ORDER BY id",
        [request.id]
      );
      documents = docs.rows.map((d) => ({
        id: d.id,
        fileName: d.file_name,
        docType: d.doc_type || null,
        fileHash: d.file_hash,
        visibleToSeller: d.visible_to_seller,
        uploadedAt: d.uploaded_at,
      }));
    }

    res.json({
      request: serializeRequest(request),
      documents,
      documentsVisible: canSeeDocs,
    });
  })
);

/**
 * Seller accepts the request. This unlocks the documents for the seller on-chain
 * and in the database, and moves the status to 'Accepted'.
 */
router.patch(
  "/:id/accept",
  requireAuth,
  asyncHandler(async (req, res) => {
    const request = await loadRequest(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found." });
    if (request.seller_wallet !== req.user.wallet_address) {
      return res.status(403).json({ error: "Only the seller can accept." });
    }
    if (request.status !== "Pending") {
      return res.status(400).json({ error: "Request is not pending." });
    }

    const { txHash } = req.body;
    if (txHash) await chain.assertSuccessfulTx(txHash, req.user.wallet_address);

    await pool.query(
      `UPDATE requests
          SET status = 'Accepted', documents_visible_to_seller = TRUE,
              accept_tx_hash = $1, updated_at = NOW()
        WHERE id = $2`,
      [txHash || null, request.id]
    );
    await pool.query("UPDATE documents SET visible_to_seller = TRUE WHERE request_id = $1", [
      request.id,
    ]);

    res.json({
      message: "Request accepted. Documents are now visible to you.",
      request: serializeRequest(await loadRequest(request.id)),
    });
  })
);

/** Seller or government rejects the request. */
router.patch(
  "/:id/reject",
  requireAuth,
  asyncHandler(async (req, res) => {
    const request = await loadRequest(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found." });

    const isSeller = request.seller_wallet === req.user.wallet_address;
    const isGov = req.user.role === "government";
    if (!isSeller && !isGov) return res.status(403).json({ error: "Not allowed." });
    if (!["Pending", "Accepted"].includes(request.status)) {
      return res.status(400).json({ error: "Request can no longer be rejected." });
    }

    await pool.query(
      "UPDATE requests SET status = 'Rejected', reject_reason = $1, updated_at = NOW() WHERE id = $2",
      [req.body.reason || null, request.id]
    );

    res.json({ message: "Request rejected.", request: serializeRequest(await loadRequest(request.id)) });
  })
);

/**
 * Buyer confirms payment. We verify the on-chain transaction, then move ownership
 * in the database and append the new owner to the property's history.
 */
router.patch(
  "/:id/paid",
  requireAuth,
  asyncHandler(async (req, res) => {
    const request = await loadRequest(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found." });
    if (request.buyer_wallet !== req.user.wallet_address) {
      return res.status(403).json({ error: "Only the buyer can confirm payment." });
    }
    if (request.status !== "GovApproved") {
      return res.status(400).json({ error: "Request is not government-approved yet." });
    }

    const { txHash } = req.body;
    await chain.assertSuccessfulTx(txHash, req.user.wallet_address);

    // Double-check the blockchain state.
    const onchain = await chain.getOnchainRequest(request.onchain_request_id);
    if (Number(onchain.status) !== 3) {
      return res.status(400).json({ error: "On-chain payment not completed." });
    }
    const { rows: propRows } = await pool.query("SELECT * FROM properties WHERE id = $1", [
      request.property_id,
    ]);
    const property = propRows[0];
    const onchainOwner = await chain.nftRead().ownerOf(property.nft_token_id);
    if (onchainOwner.toLowerCase() !== req.user.wallet_address) {
      return res.status(400).json({ error: "On-chain ownership not transferred to buyer." });
    }

    // Update request.
    await pool.query(
      "UPDATE requests SET status = 'Paid', pay_tx_hash = $1, updated_at = NOW() WHERE id = $2",
      [txHash, request.id]
    );

    // Close the previous ownership record and add the buyer as the new owner.
    await pool.query(
      "UPDATE ownership_history SET ended_at = NOW() WHERE property_id = $1 AND ended_at IS NULL",
      [property.id]
    );
    await pool.query(
      `INSERT INTO ownership_history (property_id, owner_id, owner_wallet, price, tx_hash)
       VALUES ($1, $2, $3, $4, $5)`,
      [property.id, req.user.id, req.user.wallet_address, request.price, txHash]
    );
    await pool.query(
      `UPDATE properties
          SET owner_id = $1, owner_wallet = $2, status = 'verified', price = NULL, updated_at = NOW()
        WHERE id = $3`,
      [req.user.id, req.user.wallet_address, property.id]
    );

    res.json({ message: "Payment complete. Ownership transferred to you." });
  })
);

/** Download a document (access-controlled). */
router.get(
  "/:id/documents/:docId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const request = await loadRequest(req.params.id);
    if (!request) return res.status(404).json({ error: "Request not found." });

    const canSee =
      req.user.role === "government" ||
      request.buyer_wallet === req.user.wallet_address ||
      request.documents_visible_to_seller;
    if (!canSee) return res.status(403).json({ error: "Documents are not visible to you yet." });

    const { rows } = await pool.query(
      "SELECT * FROM documents WHERE id = $1 AND request_id = $2",
      [req.params.docId, request.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Document not found." });

    res.download(rows[0].file_path, rows[0].file_name);
  })
);

module.exports = router;
