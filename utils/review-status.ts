export type ReviewStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "OPENED_IN_X"
  | "PUBLISHED";

export function getReviewStatusLabel(status: string) {
  switch (status) {
    case "OPENED_IN_X":
      return "Opened in X";
    case "PUBLISHED":
      return "Published";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "PENDING":
      return "Pending";
    default:
      return status;
  }
}

export function isReadyToPost(status: string) {
  return status === "APPROVED";
}
