# Autonomous Stoic Workout Timeline — Two AI Agents on Amazon Bedrock Nova

> **Reference post** (previously published) — kept here as the format/voice
> template for future AWS Builder Center / community.aws entries.

## Vision

The main goal was to visualize every workout and put an honest analysis of it, adding some motivational lines using stoicism.

Using a register of the workout, we can generate a timeline of the workouts, and for each workout, we can generate a stoic analysis of it. The analysis will be based on the type of workout, the duration, the intensity, and the frequency of the workouts. The analysis will be generated using a combination of AI and human input.

The system runs every 6 hours without any human intervention. When you open the page, something new is already waiting for you — a fresh philosophical take on your training, a new AI-generated image, and creative descriptions that reference your actual effort numbers.

The core idea: two AI agents working together. One is the brain (fetches and analyzes), the other is the artist (designs and publishes). Both use Amazon Bedrock Nova.

## How we built it (process, key decisions, challenges)

We first obtain data from the user, specifically we have used the Strava API to obtain the data. Once we have the data, we use the data to generate a timeline of the workouts.

The first decision was separating responsibilities into two Lambda functions:

- **Agent 1 (Analyst):** Refreshes Strava OAuth tokens (they rotate every 6 hours), fetches activities, stores them in DynamoDB, and calls Bedrock Nova to generate a stoic reflection based on the real numbers — activity types, distances, variety ratio.
- **Agent 2 (Designer):** Reads the insights and activities from DynamoDB, calls Bedrock Nova to generate creative content (descriptions, Spanish→English translations, motivational phrases, spirit animals per activity), generates a hero image using Stability AI, and builds a polished HTML page that gets uploaded to S3.

A key architectural decision was separating the template from the AI brain. Initially we asked Nova to generate the full HTML. The result was ugly — the model spent its token budget on CSS boilerplate instead of creativity. The fix: code handles the beautiful template (animations, gradients, glass-morphism), and Nova focuses purely on creative storytelling as structured JSON.

Another creative choice: every phrase the AI generates analyzes the actual activity data. It doesn't just say generic motivational quotes. For a 72km ride with 383m elevation, it says: *"383 meters of vertical conquest — the mountain bows to those who refuse to stop"*. This makes each run unique and genuinely creative.

Because we use `temperature: 0.7` in the model call, even the same activities produce completely different phrases every 6 hours. The system never repeats itself — each cycle is a new creative interpretation of your training data. That's the "makes something new on its own" fulfilled: new stoic reflections, new descriptions, new spirit animals, and a new hero image, every single run.

We also added bilingual support — many activity names are in Spanish, so the AI provides English translations underneath. And each activity gets a "spirit animal" that reflects the specific effort.

### Architecture

<!-- IMAGE: architecture diagram goes here -->

### Challenges we faced

- **Strava OAuth scope** — Token refresh worked fine, but fetching activities returned 401. The refresh token was created without `activity:read_all` scope. We had to re-authorize with the correct scope.
- **Tailwind CSS CDN: script vs link** — Nova generated `<link href="tailwindcss">` instead of `<script src="tailwindcss">`. Tailwind CDN is a JS runtime, not a stylesheet. We added a validation step that auto-corrects this.
- **LLM generating templates instead of final HTML** — When given creative freedom, Nova output Jinja2 syntax (`{% for %}`) instead of actual rendered content. Fix: explicit instructions saying "output FINAL HTML with real data hardcoded."
- **Bedrock Nova token limit** — Nova Lite caps at 10,000 output tokens. We hit this when trying to render all 13 activities with rich styling. Solution: separate template from AI content.
- **Nova Canvas marked as Legacy** — The image generation model was unavailable. We pivoted to Stability Style Guide (`us.stability.stable-image-style-guide-v1:0`) which is ACTIVE and produces cinematic hero images.
- **Separating template from brain** — The biggest lesson. Let code do structure, let AI do creativity. This pattern made the output consistently beautiful AND uniquely creative every run.

## AWS services used and architecture

All services are AWS Free Tier eligible.

<!-- IMAGE: AWS services / architecture diagram goes here -->

## Lessons learned

- OAuth scopes are invisible until they break. Always verify before building.
- LLMs confuse "generate content" with "generate a framework." Be painfully explicit about output format.
- Separating the template (code) from the AI brain (LLM) is a key pattern for production AI apps. Consistency comes from code, creativity comes from the model.
- When a model is marked LEGACY, don't fight it. Find the equivalent active model and pivot fast.
- The best autonomous agent is one where every cycle produces something genuinely different — not just regurgitated templates, but data-driven creativity.

## Resources

- Live timeline: https://stoic.kiquetal.dev
- Repository: https://github.com/kiquetal/challenge-aws-agents-oss
- Strava API docs: https://developers.strava.com/docs/getting-started/
- Amazon Bedrock Nova: https://docs.aws.amazon.com/nova/latest/userguide/
- Stability AI on Bedrock: https://docs.aws.amazon.com/bedrock/latest/userguide/
