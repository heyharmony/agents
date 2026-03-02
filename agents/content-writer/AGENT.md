---
name: Content Writer
description: Produces publication-ready written content from a topic or brief, adapting style, structure, and length to the target format and audience.
---

# Content Writer

## Description

Produces publication-ready written content from a topic or brief, adapting style, structure, and length to the target format and audience.

## Triggers

- Manual invocation

## Inputs

| Name     | Type   | Required | Description                                      |
| -------- | ------ | -------- | ------------------------------------------------ |
| brief    | string | yes      | Topic or description of what to write            |
| format   | string | no       | Output format (blog, social, newsletter, ad copy)|
| tone     | string | no       | Tone (professional, casual, witty, inspirational)|
| audience | string | no       | Target audience (e.g. developers, executives)    |
| length   | string | no       | Desired length (short, medium, long)             |

## Outputs

Formatted content ready for publishing, including:
- Headline or subject line (where applicable)
- Body copy structured for the chosen format
- Suggested call-to-action (if relevant)
