"use client";

import Link from "next/link";
import { useTransition, type ReactNode } from "react";
import { ASSIGNMENTS_PUSH_URL, EXAM_PATH, GRADING_PATH, VITRINA_PATH } from "@/constants";
import { formatDateTime } from "@/features/canon/components/format";
import { useI18n } from "@/features/localization/i18n-provider";
import { markNotificationsReadAction } from "../actions";
import type { AppNotification } from "../types";

/** In-app notifications (Sprint 07): submitted mock exams for teachers, released results and new assignments for students. */
export function NotificationsPanel({ notifications }: { notifications: AppNotification[] }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.notifications;
  const [pending, startTransition] = useTransition();
  const unread = notifications.filter((notification) => !notification.read);
  if (notifications.length === 0) return null;

  const markRead = (ids: string[]) => {
    if (ids.length > 0) startTransition(async () => void (await markNotificationsReadAction(ids)));
  };

  return (
    <section className="card" aria-labelledby="notifications-title">
      <h2 id="notifications-title">{labels.title} {unread.length > 0 && <span className="status-pill" data-exam="approved">{labels.unread.replace("{n}", String(unread.length))}</span>}</h2>
      <ul className="review-list">
        {notifications.map((notification) => {
          const subject = notification.subjectCode ? dictionary.subjects[notification.subjectCode] : "";
          const href = notification.kind === "gift_given" ? VITRINA_PATH : notification.kind === "assignment_given" ? ASSIGNMENTS_PUSH_URL : notification.examId ? `${notification.kind === "mock_exam_graded" || notification.kind === "mock_exam_assigned" ? EXAM_PATH : GRADING_PATH}/${notification.examId}` : null;
          const text = labels.kinds[notification.kind].replace("{subject}", subject);
          return (
            <li key={notification.id}>
              {href ? (
                <Link href={href} className="review-list__item review-list__item--compact" data-state={notification.read ? "accepted" : "pending"} onClick={() => !notification.read && markRead([notification.id])}>
                  <strong className="review-list__key">{text}</strong>
                  <span>{formatDateTime(notification.createdAt, locale)}</span>
                </Link>
              ) : (
                <span className="review-list__item review-list__item--compact">{text}</span>
              )}
            </li>
          );
        })}
      </ul>
      {unread.length > 0 && (
        <div className="link-row">
          <button type="button" className="button-secondary" disabled={pending} onClick={() => markRead(unread.map((notification) => notification.id))}>{labels.markAll}</button>
        </div>
      )}
    </section>
  );
}
