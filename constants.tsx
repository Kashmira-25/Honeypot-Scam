
import React from 'react';

export const SCAM_TEMPLATES = [
  {
    id: "kyc",
    name: "KYC / Bank Block",
    initialMessage: "DEAR CUSTOMER, YOUR HDFC BANK ACCOUNT IS BLOCKED DUE TO PENDING KYC. PLEASE UPDATE AT https://hdfc-kyc-verify.me/login OR CALL BANK OFFICER AT 9182736450."
  },
  {
    id: "job",
    name: "Remote Job Scam",
    initialMessage: "Hello! I'm Priya from HR department. We saw your resume. Earn ₹8,000 daily by rating hotels on Google Maps. No investment. Reply 'YES' to start."
  },
  {
    id: "digital_arrest",
    name: "CBI / Police Threat",
    initialMessage: "This is Cyber Cell Mumbai. A parcel in your name containing illegal substances has been intercepted at Customs. You are under Digital Arrest. Stay on this chat or we dispatch team."
  },
  {
    id: "loan",
    name: "Pre-approved Loan",
    initialMessage: "Congratulation! Your pre-approved loan of ₹5,00,000 is ready for disbursal. 0% interest for 12 months. Click to claim: https://easy-loan-instantly.com/apply"
  },
  {
    id: "lottery",
    name: "KBC / Lottery Win",
    initialMessage: "CONGRATULATIONS! You have won ₹25 Lakhs in KBC Lucky Draw. Check your lottery number 8829 on WhatsApp. WhatsApp us: +91 70001 23456"
  },
  {
    id: "sextortion",
    name: "Sextortion / Blackmail",
    initialMessage: "I have your video recording from last night. If you don't want me to send it to your family, pay ₹20,000 immediately to this UPI: blackmail@okaxis."
  },
  {
    id: "electricity",
    name: "Electricity Bill Pending",
    initialMessage: "Dear Consumer, your electricity connection will be disconnected tonight at 9:30 PM because your previous month's bill was not updated. Contact 93321 04432 immediately."
  }
];

export const PERSONA_LIBRARY = [
  { id: "pensioner", name: "Retired Army Officer", tech: "Very Low", personality: "Disciplined but confused, trusts authority, worried about pension." },
  { id: "student", name: "Final Year Graduate", tech: "High", personality: "Desperate for job, uses slang, anxious about future." },
  { id: "pro", name: "Corporate Manager", tech: "Moderate", personality: "Busy, logical, slightly arrogant, checks facts but falls for urgency." },
  { id: "business", name: "Kirana Store Owner", tech: "Low", personality: "Direct, counts every rupee, scared of bank freezes, speaks rough Hinglish." },
  { id: "homemaker", name: "Anxious Mother", tech: "Low", personality: "Vulnerable, worried about kids' safety, very polite and apologetic." },
  { id: "influencer", name: "TikTok/Reels Creator", tech: "Extreme", personality: "Self-centered, fast-talker, obsessed with online presence, gullible to 'verification' badges." },
  { id: "nri", name: "Overseas IT Worker", tech: "High", personality: "Confused by Indian regulations, impatient, assumes things are digital but messy." },
  { id: "cab_driver", name: "App-based Driver", tech: "Moderate", personality: "Street smart but fears legal trouble, depends on phone for livelihood, very reactive." }
];
