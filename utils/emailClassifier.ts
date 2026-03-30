// Visa Atlas — Email Classification Pipeline
// Reuses the calendar classifier by mapping email fields to CalendarEvent shape

import { KNOWN_ORGANIZERS } from '@/constants/calendarProviders';
import {
  classifyEvent,
  type ClassifiedEvent,
  type CalendarEvent,
} from './calendarClassifier';

// ──────────────────────────────────────────────
// Email → ClassifiedEvent
// ──────────────────────────────────────────────

/**
 * Classifies an email as a potential travel booking by wrapping its
 * fields as a CalendarEvent and running the standard classifier.
 */
export function classifyEmail(
  subject: string,
  bodySnippet: string,
  senderEmail: string,
  date: string
): ClassifiedEvent | null {
  const event: CalendarEvent = {
    id: `email-${date}-${subject.slice(0, 30)}`,
    title: subject,
    notes: bodySnippet,
    organizer: senderEmail,
    startDate: date,
    endDate: date,
  };
  return classifyEvent(event);
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** Extracts the domain portion from an email address. */
export function extractDomain(email: string): string {
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) return email.toLowerCase();
  return email.slice(atIndex + 1).toLowerCase();
}

/**
 * Returns true when the sender's email domain matches (or is a
 * subdomain of) any domain in the KNOWN_ORGANIZERS list.
 */
export function isKnownTravelSender(senderEmail: string): boolean {
  const domain = extractDomain(senderEmail);
  return Object.keys(KNOWN_ORGANIZERS).some((known) => domain.includes(known));
}

/**
 * Builds a Gmail-compatible search query that targets emails from
 * known travel providers within the given number of days.
 */
export function buildGmailSearchQuery(daysBack: number): string {
  const domains = Object.keys(KNOWN_ORGANIZERS);
  const fromClauses = domains.map((d) => `from:${d}`).join(' OR ');
  return `(${fromClauses}) newer_than:${daysBack}d`;
}
