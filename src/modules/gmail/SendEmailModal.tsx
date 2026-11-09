import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Button } from "../../components/common/Button.js";
import { Input } from "../../components/common/Input.js";
import { Modal } from "../../components/common/Modal.js";
import { TextArea } from "../../components/common/TextArea.js";
import { api, formatMoney } from "../../services/api-client.js";

type InvoiceDraft = {
  id: string;
  invoiceNumber: string;
  dueDate: string;
  amountMinor: number;
  outstandingMinor: number;
  currency?: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  customer: { id: string; displayName: string; email?: string | null; companyName?: string | null };
  invoice?: InvoiceDraft;
};

function initialBody(customerName: string, invoice?: InvoiceDraft) {
  if (!invoice) return `Hello ${customerName},\n\nI am writing regarding your account. Please let us know if you have any questions.\n\nRegards`;
  return [
    `Hello ${customerName},`,
    "",
    "This is a reminder regarding your outstanding invoice.",
    "",
    `Invoice Number: ${invoice.invoiceNumber}`,
    `Invoice Amount: ${formatMoney(invoice.amountMinor, invoice.currency || "INR")}`,
    `Due Date: ${invoice.dueDate}`,
    `Outstanding Amount: ${formatMoney(invoice.outstandingMinor, invoice.currency || "INR")}`,
    "",
    "Please arrange payment at your earliest convenience.",
    "",
    "Regards",
  ].join("\n");
}

export function SendEmailModal({ isOpen, onClose, customer, invoice }: Props) {
  const { data: connection } = useQuery({ queryKey: ["gmail-connection"], queryFn: api.getGmailConnection, enabled: isOpen });
  const [recipientEmail, setRecipientEmail] = useState(customer.email || "");
  const [subject, setSubject] = useState(invoice ? `Payment Reminder - Invoice ${invoice.invoiceNumber}` : `Payment follow-up - ${customer.displayName}`);
  const [body, setBody] = useState(initialBody(customer.displayName, invoice));
  const [sending, setSending] = useState(false);

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    try {
      // This compose flow sends the invoice details in the message body and deliberately
      // avoids the server's stored-document attachment path.
      await api.sendEmail({ customerId: customer.id, recipientEmail, subject, body });
      toast.success(`Email sent to ${recipientEmail}`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Email could not be sent");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send email" description={connection?.email ? `From ${connection.email}` : "Sending from your connected Gmail account"} maxWidth="lg">
      <form onSubmit={(event) => void send(event)} className="space-y-4">
        <Input label="To" type="email" required value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} />
        <Input label="Subject" required maxLength={998} value={subject} onChange={(event) => setSubject(event.target.value)} />
        <TextArea label="Message" required rows={12} value={body} onChange={(event) => setBody(event.target.value)} helperText="Line breaks are preserved in the email." />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button type="submit" isLoading={sending}>Send email</Button>
        </div>
      </form>
    </Modal>
  );
}
