# Privacy Policy & Data Processing Agreement (DPA)

**Last Updated: May 2026**

Welcome to **iFragment**. We are committed to protecting your privacy and ensuring compliance with the General Data Protection Regulation (GDPR), the California Consumer Privacy Act (CCPA), and other global data protection standards. 

---

## 1. General Principles & GDPR Compliance
As a GDPR-compliant processor/controller, we respect your rights regarding your personal data. 
- **Lawfulness, Fairness, and Transparency**: We process your personal data only when we have a lawful basis (e.g., performance of a contract, legitimate interest, or consent).
- **Purpose Limitation**: Data collected is strictly used to provide analytics, premium reporting, bot management, and marketplace services for Telegram usernames.
- **Data Minimization**: We only collect the minimal required footprint (your public Telegram profile information and necessary payment logs).

---

## 2. Your Rights Under GDPR
Under the General Data Protection Regulation, you have the following rights:
1. **Right of Access (Article 15)**: You can request details of the personal data we hold about you.
2. **Right to Rectification (Article 16)**: You can request updates or corrections to your data.
3. **Right to Erasure / "Right to be Forgotten" (Article 17)**: You have the right to request that we physically delete all your data from our active databases and caches.
4. **Right to Restriction of Processing (Article 18)**: You can request that we restrict processing under specific conditions.
5. **Right to Data Portability (Article 20)**: You can request a copy of your personal data in a structured, commonly used machine-readable format.

---

## 3. Physical Data Deletion (GDPR "Right to be Forgotten")
To guarantee absolute compliance with the **Right to be Forgotten (GDPR Article 17)**, we provide an automated, physical data deletion mechanism:

*   **Endpoint**: `DELETE /api/v1/profile/gdpr`
*   **Action**: This endpoint triggers an immediate **physical deletion** cascade (`ON DELETE CASCADE`) at the database level.
*   **Scope of Deletion**:
    *   Your primary user record in `users` is permanently destroyed.
    *   All bot management associations (`managed_bots`), connected channels (`managed_channels`), and groups (`managed_groups`) are instantly deleted.
    *   All premium usernames purchase invoices, FRG coin balances, transactions, and user stats are physically erased.
    *   All active caches inside Dragonfly/Redis (including leaderboard rankings, referrals, achievements, and stats) are immediately evicted.
    *   No soft-delete flags are used; data is physically deleted to ensure complete eradication.
*   **How to Trigger**: You can request full data erasure directly through the in-app user profile settings interface under "GDPR Right to be Forgotten", which invokes the above endpoint.

---

## 4. Data Processing Agreement (DPA)
For business owners, bot operators, and channel administrators utilizing our automation and moderation services, this Privacy Policy serves as or references our **Data Processing Agreement (DPA)**:
- **Processor Role**: When you connect bots to manage groups/channels, iFragment acts as a **Data Processor** on your behalf, and you act as the **Data Controller**.
- **Security Standards**: We employ advanced transport security (TLS 1.3), database connection pooling safety, brute-force IP/user locks, sliding-window rate limiters, and Otel-traceable audit logs to ensure high levels of confidentiality, integrity, and resilience.
- **Data Sharing**: We never share, sell, or trade your personal data, or the data of members in your managed channels, with third parties.

---

## 5. Contact & Support
For any questions regarding this Privacy Policy, your data protection rights, or to request manual deletion, please contact our Data Protection Officer (DPO) at `dpo@ifragment.com`.
