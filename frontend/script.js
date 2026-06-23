// Load AWS Amplify from AWS official distribution
const amplifyScript = document.createElement('script');
amplifyScript.src = 'https://aws-amplify.github.io/amplify-js/assets/amplify.min.js';
amplifyScript.async = true;
amplifyScript.onload = function() {
  console.log("✅ AWS Amplify loaded successfully");
  setupApp();
};
amplifyScript.onerror = function() {
  console.error("❌ Failed to load AWS Amplify from CDN, trying fallback...");
  // Fallback: Load from jsDelivr
  const fallbackScript = document.createElement('script');
  fallbackScript.src = 'https://cdn.jsdelivr.net/npm/aws-amplify@latest/dist/aws-amplify.js';
  fallbackScript.async = true;
  fallbackScript.onload = function() {
    console.log("✅ AWS Amplify loaded from fallback CDN");
    setupApp();
  };
  fallbackScript.onerror = function() {
    console.error("❌ Failed to load AWS Amplify from fallback CDN as well");
  };
  document.head.appendChild(fallbackScript);
};
document.head.appendChild(amplifyScript);

// Setup app once Amplify is loaded and DOM is ready
async function setupApp() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    await initializeApp();
  }
}

async function initializeApp() {
  console.log("🚀 Initializing CloudSnap application...");
  
  // AWS Amplify from jsDelivr is exposed as 'aws_amplify'
  const Amplify = window.aws_amplify;
  
  if (!Amplify) {
    console.error("❌ aws_amplify not found in window object");
    return;
  }
  
  console.log("✅ Amplify found:", typeof Amplify);
  console.log("📦 Amplify methods available:", Object.keys(Amplify).slice(0, 20));
  
  // The configure method might be under a different location
  const Auth = Amplify.Auth;
  let configure = Amplify.configure || Amplify.Amplify?.configure;
  
  if (!configure) {
    console.error("❌ Amplify.configure not found. Available keys:", Object.keys(Amplify));
    return;
  }

// --- AMPLIFY CONFIGURATION ---
configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_BILlNM20K',
      userPoolClientId: '1gvbhal6ruarketr3oc08s1vph',
      loginWith: {
        oauth: {
          domain: 'us-east-1billnm20k.auth.us-east-1.amazoncognito.com', 
          scopes: ['openid', 'email', 'profile'],
          redirectSignIn: [
            'https://d27xgyz8l8wwy4.cloudfront.net',
            'https://d27xgyz8l8wwy4.cloudfront.net/',
            'http://serverless-photo-website-group6.s3-website-us-east-1.amazonaws.com',
            'http://localhost:3000'
          ], 
          redirectSignOut: [
            'https://d27xgyz8l8wwy4.cloudfront.net',
            'https://d27xgyz8l8wwy4.cloudfront.net/',
            'http://serverless-photo-website-group6.s3-website-us-east-1.amazonaws.com',
            'http://localhost:3000'
          ],
          responseType: 'code' 
        }
      }
    }
  }
});

console.log("✅ Amplify configured successfully");

// DOM Element Selectors - NOW SAFE because DOM is loaded
const input = document.getElementById("imageInput");
const fileName = document.getElementById("fileName");
const uploadBtn = document.getElementById("uploadBtn");
const steps = document.querySelectorAll(".step");
const originalPreview = document.getElementById("originalPreview");
const resizedPreview = document.getElementById("resizedPreview");
const uploadSection = document.getElementById("upload");
const showUploadBtn = document.getElementById("showUploadBtn");
const startUploadBtn = document.getElementById("startUploadBtn");
const closeUploadBtn = document.getElementById("closeUploadBtn");

// New Auth Element Selectors
const loggedOutView = document.getElementById("loggedOutView");
const loggedInView = document.getElementById("loggedInView");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loggedInUser = document.getElementById("loggedInUser");

const API_GATEWAY_URL = "https://cco10loarj.execute-api.us-east-1.amazonaws.com";

console.log("✅ DOM elements found:");
console.log("  - Login button:", loginBtn);
console.log("  - Logout button:", logoutBtn);
console.log("  - loggedOutView:", loggedOutView);
console.log("  - loggedInView:", loggedInView);

// Get Auth methods
const { signInWithRedirect, signOut, getCurrentUser, fetchAuthSession } = Auth;

// --- AUTHENTICATION FLOW MANAGEMENT ---

// Wire up login/logout redirect interactions
if (loginBtn) {
  loginBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    console.log("🔐 Login button CLICKED! Initiating OAuth redirect...");
    try {
      console.log("🔄 Calling signInWithRedirect()...");
      await signInWithRedirect();
      console.log("✅ signInWithRedirect executed");
    } catch (err) {
      console.error("❌ Login failed:", err);
      alert("Login failed: " + err.message);
    }
  });
  console.log("✅ Login button event listener attached");
} else {
  console.error("❌ Login button element not found!");
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    console.log("🚪 Logout button clicked!");
    try {
      await signOut();
      console.log("✅ User signed out");
    } catch (err) {
      console.error("❌ Logout failed:", err);
    }
  });
  console.log("✅ Logout button event listener attached");
}

// Evaluates the user's active session state on page load
async function checkUserSession() {
    try {
        const user = await getCurrentUser();
        
        // User is authenticated successfully -> Show profile panel
        if (loggedOutView) loggedOutView.classList.add("hidden");
        if (loggedInView) loggedInView.classList.remove("hidden");
        if (loggedInUser) loggedInUser.textContent = user.username;
        
        // Un-hide the action triggers so they can launch the upload panel card
        if (showUploadBtn) showUploadBtn.classList.remove("hidden");
        if (startUploadBtn) startUploadBtn.classList.remove("hidden");
        
        console.log("Session authenticated successfully for:", user.username);
    } catch (err) {
        // User is not logged in or token expired -> Lock UI views down
        if (loggedOutView) loggedOutView.classList.remove("hidden");
        if (loggedInView) loggedInView.classList.add("hidden");
        
        // Keep file upload workflow hidden until authentication passes
        if (uploadSection) uploadSection.classList.add("hidden");
        if (showUploadBtn) showUploadBtn.classList.add("hidden");
        if (startUploadBtn) startUploadBtn.classList.add("hidden");
        
        console.log("No authenticated user profile detected locally.");
    }
}

async function getCognitoToken() {
    try {
        const session = await fetchAuthSession();
        const idToken = session.tokens?.idToken?.toString();
        
        if (!idToken) {
            throw new Error("No active credentials found in local storage.");
        }
        
        return idToken;
    } catch (err) {
        console.error("Amplify Auth Error:", err);
        alert("Session expired or unauthorized. Please log in again.");
        return null;
    }
}

// --- CORE APPLICATION UPLOAD & VIEW WORKFLOW ---

function showUploadSection() {
  uploadSection.classList.remove("hidden");
  uploadSection.scrollIntoView({ behavior: "smooth", block: "center" });
}

function closeUploadSection() {
  uploadSection.classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

if (showUploadBtn) showUploadBtn.addEventListener("click", showUploadSection);
if (startUploadBtn) startUploadBtn.addEventListener("click", showUploadSection);
if (closeUploadBtn) closeUploadBtn.addEventListener("click", closeUploadSection);

input.addEventListener("change", () => {
  const file = input.files[0];
  if (!file) return;

  fileName.textContent = file.name;

  const reader = new FileReader();
  reader.onload = (event) => {
    originalPreview.src = event.target.result;
    resizedPreview.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

uploadBtn.addEventListener("click", async () => {
  const file = input.files[0];

  if (!file) {
    alert('Please select an image to upload.');
    return;
  }

  await uploadImage(file);  

  steps.forEach(step => step.classList.remove("active"));
  steps.forEach((step, index) => {
    setTimeout(() => {
      step.classList.add("active");
    }, index * 700);
  });
  
  setTimeout(() => {
    retrieveProcessedImages();
  }, 3800);
});

async function uploadImage(file) {
    if (!file) return alert('Please select a file first.');

    try {
        const token = await getCognitoToken();
        if (!token) return;

        const apiResponse = await fetch(`${API_GATEWAY_URL}/get-presigned-url`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                fileName: file.name,
                fileType: file.type
            })
        });

        if (!apiResponse.ok) {
            throw new Error(`API Gateway error: ${apiResponse.statusText}`);
        }
        
        const data = await apiResponse.json();
        const s3PresignedUrl = data.uploadUrl;

        const s3Upload = await fetch(s3PresignedUrl, {
            method: 'PUT',
            headers: {
                'Content-Type' : file.type,
                'x-amz-server-side-encryption': 'aws:kms',
                'x-amz-server-side-encryption-aws-kms-key-id': 'arn:aws:kms:us-east-1:337763382699:key/2a0566eb-80cb-4a5b-be8c-bdd6abfe5b03'
            },
            body: file 
        });

        if (s3Upload.ok) {
            alert('Image successfully uploaded straight to S3!');
        } else {
            const errorText = await s3Upload.text();
            console.error("--- DETAILED S3 ERROR CORES ---");
            console.error(errorText);
            alert(`S3 Upload failed with status: ${s3Upload.status}. Check console for details!`);
        }

    } catch (error) {
        console.error("Upload error sequence broken:", error);
        alert(`An error occurred: ${error.message}`);
    }
}

async function retrieveProcessedImages() {
    try {
        console.log(`Retrieving processed images via authenticated Cognito session`);
        
        const token = await getCognitoToken();
        if (!token) return;

        const response = await fetch(`${API_GATEWAY_URL}/get-processed-images`, {
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to retrieve images: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Retrieved images:", data);
        
        if (data.images && data.images.length > 0) {
            displayDownloadButtons(data.images);
        } else {
            alert('No processed images found yet. Please wait a moment and try again.');
        }
        
    } catch (error) {
        console.error("Error retrieving images:", error);
        alert('Error retrieving images. Check console for details.');
    }
}

function displayDownloadButtons(images) {
    const downloadsContainer = document.getElementById('downloadsContainer');
    if (!downloadsContainer) return;
    
    downloadsContainer.innerHTML = '<h3>Download Your Images</h3>';
    
    images.forEach((image, index) => {
        const imageDiv = document.createElement('div');
        imageDiv.className = 'image-download-card';
        imageDiv.innerHTML = `
            <p><strong>Photo ${index + 1}</strong> (ID: ${image.photo_id.substring(0, 8)}...)</p>
            <div class="variant-buttons">
                ${Object.entries(image.variants)
                    .map(([platform, url]) => `
                    <a href="${url}" download class="download-btn">
                        Download ${platform.charAt(0).toUpperCase() + platform.slice(1)}
                    </a>
                    `)
                    .join('')}
            </div>
        `;
        downloadsContainer.appendChild(imageDiv);
    });
    
    downloadsContainer.classList.remove('hidden');
    downloadsContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Initialize session check execution immediately when page loads
async function processAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get('code');

    if (authCode) {
        console.log("Detected Cognito Auth Code in URL. Processing callback...");
        // Clear the URL bar so the code doesn't get re-processed on refresh
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Now run your session parsing logic
    await checkUserSession();
}

// Kick off the application workflow safely
await processAuthCallback();

} // Close initializeApp function