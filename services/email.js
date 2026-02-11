import nodemailer from 'nodemailer';

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

function getFrom() {
  return process.env.SMTP_FROM || process.env.SMTP_USER || 'Web Academy <noreply@web-academy.local>';
}

function getAppUrl() {
  return process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
}

async function sendMail(options) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[Email] SMTP non configuré (SMTP_USER/SMTP_PASS). Email non envoyé:', options.to);
    return;
  }
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: getFrom(),
      ...options
    });
  } catch (err) {
    console.error('[Email] Erreur envoi:', err.message);
  }
}

export async function sendStudentAccountCreated(to, name) {
  await sendMail({
    to,
    subject: 'Web Academy UCAO-UUT - Compte créé (en attente de vérification)',
    text: `Bonjour ${name},\n\nVotre compte étudiant Web Academy a bien été créé.\n\nVotre identité doit être confirmée par l'administration de votre institut avant que vous puissiez accéder à la plateforme. Vous recevrez un email dès que votre compte sera validé.\n\nCordialement,\nL'équipe Web Academy UCAO-UUT`,
    html: `
      <p>Bonjour ${name},</p>
      <p>Votre compte étudiant <strong>Web Academy</strong> a bien été créé.</p>
      <p>Votre identité doit être confirmée par l'administration de votre institut avant que vous puissiez accéder à la plateforme. Vous recevrez un email dès que votre compte sera validé.</p>
      <p>Cordialement,<br>L'équipe Web Academy UCAO-UUT</p>
    `
  });
}

export async function sendStudentIdentityConfirmed(to, name) {
  const loginUrl = `${getAppUrl()}/login`;
  await sendMail({
    to,
    subject: 'Web Academy UCAO-UUT - Identité confirmée, connectez-vous',
    text: `Bonjour ${name},\n\nVotre identité a été confirmée par l'administration. Vous pouvez dès à présent vous connecter à votre compte Web Academy.\n\nLien de connexion : ${loginUrl}\n\nCordialement,\nL'équipe Web Academy UCAO-UUT`,
    html: `
      <p>Bonjour ${name},</p>
      <p>Votre identité a été confirmée par l'administration. Vous pouvez dès à présent vous connecter à votre compte Web Academy.</p>
      <p><a href="${loginUrl}" style="display:inline-block;padding:10px 20px;background:#03045e;color:#fff;text-decoration:none;border-radius:6px;">Se connecter</a></p>
      <p>Cordialement,<br>L'équipe Web Academy UCAO-UUT</p>
    `
  });
}

export async function sendPasswordReset(to, name, resetUrl) {
  await sendMail({
    to,
    subject: 'Web Academy UCAO-UUT - Réinitialisation du mot de passe',
    text: `Bonjour ${name},\n\nVous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le lien ci-dessous pour en choisir un nouveau (lien valide 1 heure) :\n\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\nCordialement,\nL'équipe Web Academy UCAO-UUT`,
    html: `
      <p>Bonjour ${name},</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau (lien valide 1 heure) :</p>
      <p><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#03045e;color:#fff;text-decoration:none;border-radius:6px;">Réinitialiser mon mot de passe</a></p>
      <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      <p>Cordialement,<br>L'équipe Web Academy UCAO-UUT</p>
    `
  });
}
