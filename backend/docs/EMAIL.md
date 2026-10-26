# Taskoura Transactional Email Architecture & Configuration

This document outlines the professional transactional email setup, environment variables, local testing workflows, cloud SMTP providers, and domain deliverability records (SPF, DKIM, DMARC) for Taskoura.

---

## 1. Environment Variables

Taskoura uses Spring Boot's standard mail configuration coupled with application-specific overrides:

| Variable | Default Value | Description |
|---|---|---|
| `SPRING_MAIL_HOST` | `smtp.gmail.com` | SMTP host (e.g. `smtp-relay.brevo.com`, `localhost`) |
| `SPRING_MAIL_PORT` | `587` | SMTP port (`587` for STARTTLS, `465` for SSL, `2525` for Brevo on Render) |
| `SPRING_MAIL_USERNAME` | `gaurangchouhan316@gmail.com` | SMTP username or API login |
| `SPRING_MAIL_PASSWORD` | *(App Password / API key)* | SMTP password or master API key |
| `MAIL_FROM` | `${SPRING_MAIL_USERNAME}` | The `From` email address (e.g., `notifications@taskoura.dev`) |
| `MAIL_FROM_NAME` | `Taskoura` | Friendly sender name displayed to recipients |
| `FRONTEND_URL` | `http://localhost:5173` | Base URL used to construct links in email templates |
| `APP_NAME` | `Taskoura` | Name of the platform used in subject lines and footer |
| `OTP_PEPPER` | `${JWT_SECRET}` | Secret key used for HMAC-SHA256 hashing of OTP codes at rest |

---

## 2. Local Testing with a Mail Catcher

During local development, you can inspect rendered multipart HTML and plain-text emails without sending real messages to public inboxes.

### Option A: MailHog (Docker)
1. Run MailHog locally:
   ```bash
   docker run -d -p 1025:1025 -p 8025:8025 --name mailhog mailhog/mailhog
   ```
2. Configure Taskoura environment:
   ```bash
   export SPRING_MAIL_HOST=localhost
   export SPRING_MAIL_PORT=1025
   export SPRING_MAIL_USERNAME=
   export SPRING_MAIL_PASSWORD=
   ```
3. Open `http://localhost:8025` in your browser to view incoming transactional emails in real time.

### Option B: Inbucket / GreenMail
- In unit and integration tests, Taskoura automatically executes against `GreenMail` (an in-memory Jakarta Mail test server) on dynamically allocated ports, asserting multipart/alternative content structure.

---

## 3. Cloud Deployment: Brevo on Port 2525 (Render Free Tier)

Render and certain cloud providers block outbound traffic on standard SMTP port `25` and sometimes throttle port `587` on free-tier containers.

Brevo (formerly Sendinblue) provides free SMTP delivery on alternate port `2525`.

### Configuration Steps:
1. Create a free account at [Brevo.com](https://www.brevo.com).
2. Go to **Transactional** -> **Settings** -> **Configuration**.
3. Generate an SMTP Master Password / API Key.
4. Set the following environment variables in your Render Dashboard:
   ```env
   SPRING_MAIL_HOST=smtp-relay.brevo.com
   SPRING_MAIL_PORT=2525
   SPRING_MAIL_USERNAME=your-brevo-login@domain.com
   SPRING_MAIL_PASSWORD=your-brevo-smtp-key
   MAIL_FROM=notifications@yourdomain.com
   MAIL_FROM_NAME=Taskoura
   FRONTEND_URL=https://your-taskoura-app.onrender.com
   ```

---

## 4. Custom Sender Domain Authentication (SPF, DKIM, DMARC)

To prevent transactional emails from landing in spam or being rejected by strict mail providers (Gmail, Outlook, iCloud), configure your domain's DNS records:

### 1. SPF (Sender Policy Framework)
Authorize the sending server to send mail on behalf of your domain:
- **Type**: `TXT`
- **Host / Name**: `@` (or `yourdomain.com`)
- **Value**:
  ```text
  v=spf1 include:spf.brevo.com include:_spf.google.com ~all
  ```

### 2. DKIM (DomainKeys Identified Mail)
Sign emails cryptographically to verify message integrity:
- In your provider's dashboard (e.g. Brevo or Google Workspace), navigate to **Domains** -> **Authenticate Domain**.
- Add the generated DKIM DNS TXT or CNAME record:
  - **Type**: `TXT`
  - **Host / Name**: `mail._domainkey.yourdomain.com`
  - **Value**: `k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ...`

### 3. DMARC (Domain-based Message Authentication, Reporting, and Conformance)
Define how receiving servers handle emails failing SPF or DKIM:
- **Type**: `TXT`
- **Host / Name**: `_dmarc.yourdomain.com`
- **Value**:
  ```text
  v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@yourdomain.com; sp=quarantine
  ```
- *Tip*: Start with `p=none` for initial monitoring, then promote to `p=quarantine` or `p=reject`.

---

## 5. Security & Privacy Guarantees

1. **HMAC-SHA256 at Rest**: OTP codes are never stored in plaintext. They are salted with `otp.pepper` and hashed using HMAC-SHA256.
2. **Zero Code Logging**: Verification and reset OTP codes are never written to log files, console streams, or API responses.
3. **Attempt Limiting**: After 5 incorrect attempts, codes are immediately invalidated (`400 OTP_ATTEMPTS_EXCEEDED`).
4. **Cooldown Enforcement**: Resend and password-reset endpoints require a minimum 30-second cooldown (`429 RATE_LIMITED`).
5. **Auto-Escaped HTML**: User-submitted strings (e.g. names, titles, comments) rendered in templates are automatically escaped by Thymeleaf to prevent HTML/XSS injection in mail clients.
6. **No Credentials in URLs**: Email CTA buttons never include passwords, hashes, or tokens in query strings.
