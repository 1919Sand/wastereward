export const WASTEREWARD_WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "919509925939").replace(/\D/g, "");
export const WASTEREWARD_WHATSAPP_DISPLAY = "+91 95099 25939";

export function wasteRewardWhatsAppUrl(message: string) {
  return `https://wa.me/${WASTEREWARD_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
