// CloudSnap - Amplify Cognito Authentication
console.log("🚀 CloudSnap loading...");

// Load Amplify library asynchronously
async function loadAmplify() {
  // Use Amplify from unpkg UMD bundle
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/aws-amplify@5.3.0/dist/aws-amplify.umd.js';
    script.onload = () => {
      console.log("✅ Amplify library loaded");
      resolve(window.aws_amplify);
    };
    script.onerror = (err) => {
      console.error("❌ Failed to load Amplify:", err);
      reject(err);
    };
    document.head.appendChild(script);
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
  console.log("🚀 DOM loaded - initializing CloudSnap");

  try {
    // Load Amplify
    const amplifyModule = await loadAmplify();
    const { Amplify, Auth } = amplifyModule;

    console.log("✅ Amplify modules ready:", { Amplify: typeof Amplify, Auth: typeof Auth });

  // Configure Amplify with minimal config
  const amplifyConfig = {
    Auth: {
      region: 'us-east-1',
      userPoolId: 'us-east-1_BILlNM20K',
      userPoolWebClientId: '1gvbhal6ruarketr3oc08s1vph',
      oauth: {
        domain: 'us-east-1billnm20k.auth.us-east-1.amazoncognito.com',
        scope: ['openid', 'email', 'profile'],
        redirectSignIn: window.location.origin,
        redirectSignOut: window.location.origin,
        responseType: 'code'
      }
    }
  };

  console.log("📋 Amplify config:", amplifyConfig);

  try {
    Amplify.configure(amplifyConfig);
    console.log("✅ Amplify configured successfully!");
  } catch (err) {
    console.error("❌ Amplify configuration failed:", err);
    alert("Configuration error: " + err.message);
  }

  // Get DOM elements
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  console.log("✅ Buttons found:", { loginBtn: !!loginBtn, logoutBtn: !!logoutBtn });

  // Setup login button
  if (loginBtn) {
    loginBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      console.log("🔐 Login clicked!");
      try {
        console.log("🔄 Calling Auth.signInWithPopup()...");
        const user = await Auth.signInWithPopup();
        console.log("✅ User signed in:", user);
      } catch (err) {
        console.error("❌ Sign in error:", err);
        alert("Sign in error: " + err.message);
      }
    });
  }

  // Setup logout button
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      console.log("🚪 Logout clicked!");
      try {
        await Auth.signOut();
        console.log("✅ User signed out");
        location.reload();
      } catch (err) {
        console.error("❌ Sign out error:", err);
      }
    });
  }

  // Check current user
  async function checkUser() {
    try {
      const user = await Auth.currentAuthenticatedUser();
      console.log("✅ Current user:", user.username);
      document.getElementById("loggedOutView").classList.add("hidden");
      document.getElementById("loggedInView").classList.remove("hidden");
      document.getElementById("loggedInUser").textContent = user.username;
    } catch (err) {
      console.log("ℹ️ No user signed in (expected on first visit)");
      document.getElementById("loggedOutView").classList.remove("hidden");
      document.getElementById("loggedInView").classList.add("hidden");
    }
  }

  checkUser();
});
