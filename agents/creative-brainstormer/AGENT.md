# Creative Brainstormer

## Description

Generates a diverse set of ideas, angles, or solutions for a given challenge, ranging from conventional to unexpected, to fuel creative decision-making.

## Triggers

- Manual invocation

## Inputs

| Name     | Type   | Required | Description                                         |
| -------- | ------ | -------- | --------------------------------------------------- |
| challenge| string | yes      | The problem, theme, or area to brainstorm around    |
| quantity | string | no       | Number of ideas to generate (default: 10)           |
| style    | string | no       | Idea style (practical, bold, playful, mixed)        |
| bounds   | string | no       | Constraints or guardrails (budget, brand voice, etc)|

## Outputs

A list of ideas including:
- Each idea with a short title and one-line description
- A mix of safe bets and stretch ideas
- Optional grouping by theme when quantity is high
