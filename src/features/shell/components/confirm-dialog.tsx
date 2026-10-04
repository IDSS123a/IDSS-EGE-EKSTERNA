"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useI18n } from "@/features/localization/i18n-provider";

type Ask = (message: string) => Promise<boolean>;
const ConfirmContext = createContext<Ask | null>(null);

/**
 * In-app confirmation in the IDSS look, replacing the browser's own confirm box. A native modal <dialog>: focus stays
 * inside, Escape cancels, the confirm button has the focus first.
 */
export function ConfirmProvider({ children }: { children: ReactNode }): ReactNode {
  const { dictionary } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const resolver = useRef<((answer: boolean) => void) | null>(null);
  const [message, setMessage] = useState("");

  const ask = useCallback<Ask>((text) => {
    resolver.current?.(false);
    setMessage(text);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  useEffect(() => {
    if (message && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [message]);

  const answer = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    if (dialog.current?.open) dialog.current.close();
    setMessage("");
  };

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <dialog ref={dialog} className="confirm-dialog" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message"
        onCancel={(event) => { event.preventDefault(); answer(false); }}>
        <h2 id="confirm-dialog-title" className="confirm-dialog__title">{dictionary.common.confirmTitle}</h2>
        <p id="confirm-dialog-message" className="confirm-dialog__message">{message}</p>
        <div className="link-row confirm-dialog__actions">
          <button type="button" className="button-primary" autoFocus onClick={() => answer(true)}>{dictionary.common.confirmYes}</button>
          <button type="button" className="button-secondary" onClick={() => answer(false)}>{dictionary.common.confirmNo}</button>
        </div>
      </dialog>
    </ConfirmContext.Provider>
  );
}

/** Ask for confirmation in the IDSS dialog; resolves true on Potvrdi. */
export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext);
  if (!ask) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ask;
}

/**
 * onSubmit handler for a form that needs a confirmation. `messageFor` gets the button that submitted the form and
 * returns the question, or null when that button needs none. After Potvrdi the form is submitted again with the same
 * button, so its name and value reach the action.
 */
export function useConfirmSubmit(messageFor: (submitter: HTMLButtonElement | null) => string | null): (event: FormEvent<HTMLFormElement>) => void {
  const ask = useConfirm();
  const approved = useRef(false);
  return (event) => {
    if (approved.current) {
      approved.current = false;
      return;
    }
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const message = messageFor(submitter);
    if (!message) return;
    event.preventDefault();
    void ask(message).then((ok) => {
      if (!ok) return;
      approved.current = true;
      form.requestSubmit(submitter && form.contains(submitter) ? submitter : undefined);
    });
  };
}
