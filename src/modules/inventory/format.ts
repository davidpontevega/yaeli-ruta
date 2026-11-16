export { formatQty } from "@/lib/quantity";

/** "2027-03-31" → "31/03/2027" */
export const formatDate = (iso: string) => iso.split("-").reverse().join("/");
