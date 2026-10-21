// routes/legal.js
// Public pages required by Google's OAuth consent screen.
const express = require('express');
const router = express.Router();

const page = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} - StudyHub SA</title>
<style>body{font-family:Arial,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;line-height:1.6;color:#1C2430}h1{color:#1E3A5F}a{color:#1E3A5F}</style>
</head><body>${body}</body></html>`;

router.get('/home', (req, res) => {
  res.send(page('Home', `
    <h1>StudyHub SA</h1>
    <p>StudyHub SA is a mobile learning and collaboration app for South African college and university students. Students can share study resources, join study groups, chat, track academic deadlines, and get AI-powered study help in one place.</p>
    <p><a href="/privacy">Privacy Policy</a> | <a href="/terms">Terms of Service</a></p>`));
});

router.get('/privacy', (req, res) => {
  res.send(page('Privacy Policy', `
    <h1>Privacy Policy</h1>
    <p>StudyHub SA only collects what it needs to run the app.</p>
    <h3>What we collect</h3>
    <ul>
      <li>Your name, email address and student number when you register.</li>
      <li>If you sign in with Google, your name, email address and profile picture from your Google account.</li>
      <li>Content you create in the app: resources, group messages, comments, calendar events and notes.</li>
    </ul>
    <h3>How we use it</h3>
    <p>To create and secure your account, show your profile to other students, and provide the app's features. Passwords are hashed and never stored in plain text. We do not sell your data or share it with advertisers.</p>
    <h3>Third parties</h3>
    <p>We use Google Sign-In and Firebase for authentication, and Google's Gemini API to answer questions you submit in AI Study Assist.</p>
    <h3>Deleting your data</h3>
    <p>To request deletion of your account and data, email YOUR_EMAIL@gmail.com.</p>
    <p><a href="/home">Back to home</a></p>`));
});

router.get('/terms', (req, res) => {
  res.send(page('Terms of Service', `
    <h1>Terms of Service</h1>
    <p>By using StudyHub SA you agree to use it for legitimate study purposes, to be respectful to other students, and not to upload content you do not have the right to share or that is harmful or unlawful. We may remove content or accounts that break these rules. The app is provided as-is for educational purposes. Questions: YOUR_EMAIL@gmail.com.</p>
    <p><a href="/home">Back to home</a></p>`));
});

module.exports = router;