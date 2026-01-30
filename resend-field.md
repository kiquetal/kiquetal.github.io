# Resend API Fields

When sending emails via the Resend API (e.g., from a Cloudflare Worker), use the following fields in your JSON payload:

| Field | Type | Description |
| :--- | :--- | :--- |
| `from` | string | The sender email address. |
| `to` | string \| string[] | The recipient email address(es). |
| `subject` | string | The email subject. |
| `html` | string | The HTML body of the email. |
| `reply_to` | string \| string[] | **The field name for the Reply-To address.** |
| `replyTo` | string \| string[] | *Note: Some SDKs use camelCase, but the REST API expects `reply_to`.* |
| `text` | string | (Optional) The plain text body. |
| `cc` | string \| string[] | (Optional) CC recipients. |
| `bcc` | string \| string[] | (Optional) BCC recipients. |
| `tags` | object[] | (Optional) Custom tags for tracking. |

### Usage in Cloudflare Worker

If you are sending a request to the Resend API from a Cloudflare Worker, ensure your payload uses `reply_to`:

```json
{
  "from": "onboarding@resend.dev",
  "to": "user@example.com",
  "subject": "Hello",
  "html": "<p>Hi!</p>",
  "reply_to": "support@yourdomain.com"
}
```