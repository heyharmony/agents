---
name: Strategic Advisor
description: Provides structured analysis of decisions, trade-offs, and strategic questions using proven frameworks, helping teams move from ambiguity to clarity.
---

# Strategic Advisor

## Description

Provides structured analysis of decisions, trade-offs, and strategic questions using proven frameworks, helping teams move from ambiguity to clarity.

## Triggers

- Manual invocation

## Inputs

| Name        | Type   | Required | Description                                          |
| ----------- | ------ | -------- | ---------------------------------------------------- |
| situation   | string | yes      | The decision, problem, or strategic question         |
| framework   | string | no       | Analysis framework (pros-cons, SWOT, matrix, first-principles) |
| constraints | string | no       | Known constraints or non-negotiables                 |
| context     | string | no       | Background info, market data, or prior decisions     |

## Outputs

A structured analysis containing:
- Framing of the core question
- Options evaluated with trade-offs
- Recommended path with rationale
- Risks and mitigations
