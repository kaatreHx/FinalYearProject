import type { PurchaseRequest } from "@/types/purchase-request";

// Replace this with a real fetch to your backend once the requests
// endpoint exists, e.g. GET `${API_BASE_URL}/properties/:id/requests`
export const MOCK_PURCHASE_REQUESTS: PurchaseRequest[] = [
  {
    id: "r1",
    propertyId: "p1",
    buyerName: "Sujata Rana",
    buyerEmail: "sujata.rana@example.com",
    offerPrice: 178000,
    message:
      "Loved the riverside view on the listing photos. Would you consider 178,000 with a 30-day close?",
    status: "Pending",
    submittedAt: "2026-08-19T09:14:00Z",
  },
  {
    id: "r2",
    propertyId: "p1",
    buyerName: "Manish Thapa",
    buyerEmail: "manish.thapa@example.com",
    offerPrice: 185000,
    message: "Full asking price, pre-approved financing. Can move quickly.",
    status: "Pending",
    submittedAt: "2026-08-21T14:02:00Z",
    documents: [
      { id: "d1", name: "proof-of-funds.pdf" },
      { id: "d2", name: "pre-approval-letter.pdf" },
    ],
  },
  {
    id: "r3",
    propertyId: "p1",
    buyerName: "Kabita Adhikari",
    buyerEmail: "kabita.a@example.com",
    offerPrice: 165000,
    message: "Is there any flexibility on price given the unit needs a repaint?",
    status: "Declined",
    submittedAt: "2026-08-10T11:40:00Z",
  },
  {
    id: "r4",
    propertyId: "p2",
    buyerName: "Rohan Basnet",
    buyerEmail: "rohan.basnet@example.com",
    offerPrice: 335000,
    message: "Family of four, would love to schedule a viewing this weekend.",
    status: "Accepted",
    submittedAt: "2026-08-05T08:30:00Z",
  },
  {
    id: "r5",
    propertyId: "p5",
    buyerName: "Alina Karki",
    buyerEmail: "alina.karki@example.com",
    offerPrice: null,
    message:
      "Interested in renting from October. Is the loft furnished, and are pets allowed?",
    status: "Pending",
    submittedAt: "2026-08-22T16:55:00Z",
  },
  {
    id: "r6",
    propertyId: "p6",
    buyerName: "Deepak Joshi",
    buyerEmail: "deepak.joshi@example.com",
    offerPrice: 395000,
    message: "Retail brokerage inquiry on behalf of a client — open to a counter?",
    status: "Pending",
    submittedAt: "2026-08-23T10:05:00Z",
  },
  {
    id: "r7",
    propertyId: "p1",
    buyerName: "Nirmala Rai",
    buyerEmail: "nirmala.rai@example.com",
    offerPrice: 180000,
    message: "Cash buyer, can close within two weeks.",
    status: "Accepted",
    submittedAt: "2026-04-12T11:20:00Z",
  },
  {
    id: "r8",
    propertyId: "p2",
    buyerName: "Suresh Lama",
    buyerEmail: "suresh.lama@example.com",
    offerPrice: 328000,
    message: "Relocating for work, need to move in by June.",
    status: "Accepted",
    submittedAt: "2026-05-19T13:45:00Z",
  },
  {
    id: "r9",
    propertyId: "p5",
    buyerName: "Bina Tamang",
    buyerEmail: "bina.tamang@example.com",
    offerPrice: null,
    message: "Interested in a 12-month lease starting July.",
    status: "Accepted",
    submittedAt: "2026-06-08T09:15:00Z",
  },
  {
    id: "r10",
    propertyId: "p6",
    buyerName: "Ramesh Khadka",
    buyerEmail: "ramesh.khadka@example.com",
    offerPrice: 402000,
    message: "Looking to open a second store location here.",
    status: "Accepted",
    submittedAt: "2026-07-14T16:00:00Z",
  },
  {
    id: "r11",
    propertyId: "p1",
    buyerName: "Sarita Bhattarai",
    buyerEmail: "sarita.b@example.com",
    offerPrice: 172000,
    message: "First-time buyer, financing pre-approved for this amount.",
    status: "Declined",
    submittedAt: "2026-07-26T12:30:00Z",
  },
  {
    id: "r12",
    propertyId: "p5",
    buyerName: "Ujwal Poudel",
    buyerEmail: "ujwal.poudel@example.com",
    offerPrice: null,
    message: "Would love a viewing this week if possible.",
    status: "Pending",
    submittedAt: "2026-08-26T08:40:00Z",
  },
];

export function getRequestsForProperty(
  requests: PurchaseRequest[],
  propertyId: string
): PurchaseRequest[] {
  return requests
    .filter((request) => request.propertyId === propertyId)
    .sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
}

export function countPendingRequests(
  requests: PurchaseRequest[],
  propertyId: string
): number {
  return requests.filter(
    (request) => request.propertyId === propertyId && request.status === "Pending"
  ).length;
}

export function formatRequestDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export interface NewPurchaseRequestInput {
  propertyId: string;
  buyerName: string;
  buyerEmail: string;
  offerPrice: number | null;
  message: string;
  documentNames: string[];
}

// Builds a PurchaseRequest from the buyer's "Make a purchase request"
// form. Replace this with a real POST to your backend once the
// requests endpoint exists, e.g. POST `${API_BASE_URL}/properties/:id/requests`
export function createPurchaseRequest(
  input: NewPurchaseRequestInput
): PurchaseRequest {
  return {
    id: `r-${Date.now()}`,
    propertyId: input.propertyId,
    buyerName: input.buyerName,
    buyerEmail: input.buyerEmail,
    offerPrice: input.offerPrice,
    message: input.message,
    status: "Pending",
    submittedAt: new Date().toISOString(),
    documents: input.documentNames.map((name, i) => ({
      id: `doc-${Date.now()}-${i}`,
      name,
    })),
  };
}
