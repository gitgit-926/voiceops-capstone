// Utility to format raw markdown source filenames into clean, customer-friendly policy titles

const POLICY_TITLES = {
  '00_about_this_knowledge_base.md': 'Knowledge Base Overview',
  'agent_conversation_style.md': 'Support Guidelines',
  'agent_escalation_handoff.md': 'Escalation Policy',
  'agent_identity_verification.md': 'Identity Verification Policy',
  'faq_general.md': 'Frequently Asked Questions',
  'faq_hindi.md': 'General FAQ (Hindi)',
  'help_reverse_pickup.md': 'Reverse Pickup Help Guide',
  'help_track_order.md': 'Order Tracking Guide',
  'help_troubleshooting_electronics.md': 'Electronics Troubleshooting',
  'mkt_plus_benefits_page.md': 'ZentroMart Plus Benefits',
  'pol_cancellations.md': 'Cancellation Policy',
  'pol_coupons_offers.md': 'Coupons & Offers Policy',
  'pol_damaged_wrong_missing.md': 'Damaged & Missing Items Policy',
  'pol_delivery_shipping.md': 'Delivery & Shipping Policy',
  'pol_marketplace_sellers.md': 'Marketplace Sellers Policy',
  'pol_payments_cod.md': 'Payments & COD Policy',
  'pol_plus_membership.md': 'ZentroMart Plus Membership',
  'pol_refunds.md': 'Refunds & Timelines Policy',
  'pol_returns_v3_superseded.md': 'Previous Returns Policy',
  'pol_returns_v4.md': 'Returns Policy',
  'pol_warranty_assured.md': 'Warranty & Guarantee Policy',
};

export function formatSourceTitle(filename) {
  if (!filename) return '';
  const cleanName = filename.trim();
  if (POLICY_TITLES[cleanName]) {
    return POLICY_TITLES[cleanName];
  }
  // Fallback clean formatting
  return cleanName
    .replace(/^pol_|^help_|^faq_|^mkt_/, '')
    .replace(/\.md$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
