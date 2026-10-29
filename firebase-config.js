/* Firebase web config: вставь сюда параметры своего Firebase-проекта. Это не приватный серверный ключ. */
(function(){
  const firebaseConfig = {
    apiKey: "PASTE_API_KEY_HERE",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "PASTE_MESSAGING_SENDER_ID_HERE",
    appId: "PASTE_APP_ID_HERE"
  };
  const configured = firebaseConfig.apiKey !== "PASTE_API_KEY_HERE" && firebaseConfig.projectId !== "YOUR_PROJECT_ID" && firebaseConfig.appId !== "PASTE_APP_ID_HERE";
  window.GTSHOP_FIREBASE_CONFIGURED = false;
  if (!configured || !window.firebase) return;
  try { window.firebase.initializeApp(firebaseConfig); window.GTSHOP_FIREBASE_CONFIGURED = true; }
  catch (error) { console.error("GT SHOP Firebase init failed", error); }
})();
