import nodemailer from "nodemailer";
import { required } from "./env";
export async function sendMail(to: string, subject: string, text: string) {
  const transport = nodemailer.createTransport({
    host: required("SMTP_HOST"),
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === "465",
    auth: { user: required("SMTP_USER"), pass: required("SMTP_PASSWORD") },
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
  await transport.sendMail({ from: required("MAIL_FROM"), to, subject, text });
}
