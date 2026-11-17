/** wa.me needs the country code: a 9-digit Peruvian mobile gets 51 in front. */
export const waNumber = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return d.length === 9 ? `51${d}` : d;
};
