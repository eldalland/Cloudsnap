// CloudSnap - Amplify Cognito Authentication
console.log("🚀 CloudSnap initializing...");

let Auth; // Will be set after Amplify loads

// Load Amplify library
function loadAmplifyLibrary() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://cdn.jsdelivr.net/npm/aws-amplify/dist/aws-amplify.mjs';
    script.onload = () => {
      console.log("✅ Amplify v6 library loaded");
      resolve(window.aws_amplify);
    };
    script.onerror = () => {
      console.error("❌ Failed to load Amplify");
      reject(new Error("Failed to load Amplify"));
    };
    document.head.appendChild(script);
  });
}

// Get token from Auth session
async function getCognitoToken() {
  try {
    const { fetchAuthSession } = AmplifyLib.auth;
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    
    if (!idToken) {
      throw new Error("No active credentials found in local storage.");
    }
    
    return idToken;
  } catch (err) {
    console.error("❌ Auth Error:", err);
    alert("Session expired or unauthorized. Please log in again.");
    return null;
  }
}

// Check current user session
async function checkUserSession(AmplifyLib) {
  try {
    const { getCurrentUser } = AmplifyLib.auth;
    const user = await getCurrentUser();
    console.log("✅ Current user:", user.username);
    
    // Show logged in view
    const loggedOutView = document.getElementById("loggedOutView");
    const loggedInView = document.getElementById("loggedInView");
    const loggedInUser = document.getElementById("loggedInUser");
    const showUploadBtn = document.getElementById("showUploadBtn");
    const startUploadBtn = document.getElementById("startUploadBtn");
    
    if (loggedOutView) loggedOutView.classList.add("hidden");
    if (loggedInView) loggedInView.classList.remove("hidden");
    if (loggedInUser) loggedInUser.textContent = user.username;
    if (showUploadBtn) showUploadBtn.classList.remove("hidden");
    if (startUploadBtn) startUploadBtn.classList.remove("hidden");
  } catch (err) {
    console.log("ℹ️ No user signed in:", err.name || err.message);
    
    // Show logged out view
    const loggedOutView = document.getElementById("loggedOutView");
    const loggedInView = document.getElementById("loggedInView");
    const uploadSection = document.getElementById("upload");
    const showUploadBtn = document.getElementById("showUploadBtn");
    const startUploadBtn = document.getElementById("startUploadBtn");
    
    if (loggedOutView) loggedOutView.classList.remove("hidden");
    if (loggedInView) loggedInView.classList.add("hidden");
    if (uploadSection) uploadSection.classList.add("hidden");
    if (showUploadBtn) showUploadBtn.classList.add("hidden");
    if (startUploadBtn) startUploadBtn.classList.add("hidden");
  }
}

// Wait for DOM and initialize
document.addEventListener('DOMContentLoaded', async function() {
  console.log("🚀 DOM ready - initializing CloudSnap");

  try {
    // Load Amplify
    const amplifyModule = await loadAmplifyLibrary();
    const { Amplify } = amplifyModule;

    console.log("✅ Amplify loaded");

    // Configure Amplify
    const amplifyConfig = {
      Auth: {
        Cognito: {
            region: 'us-east-1',
            userPoolId: 'us-east-1_BILlNM20K',
            userPoolWebClientId: '1gvbhal6ruarketr3oc08s1vph',
            loginWith: {
                oauth: {
                domain: 'us-east-1billnm20k.auth.us-east-1.amazoncognito.com',
                scopes: ['openid', 'email', 'profile'],
                redirectSignIn: [window.location.origin],
                redirectSignOut: [window.location.origin],
                responseType: 'code'
                }
            }
        }
      }
    };

    Amplify.configure(amplifyConfig);
    console.log("✅ Amplify configured successfully");

    // Get DOM elements
    const loginBtn = document.getElementById("loginBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    const { signInWithRedirect, signOut } = amplifyModule.auth;

    // Setup login button
    if (loginBtn) {
      loginBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        console.log("� Login clicked - redirecting to Cognito");
        try {
          await signInWithRedirect();
        } catch (err) {
          console.error("❌ Sign in error:", err);
          alert("Login error: " + err.message);
        }
      });
      console.log("✅ Login button ready");
    }

    // Setup logout button
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        console.log("🚪 Logout clicked");
        try {
          await signOut();
          console.log("✅ User signed out");
          location.reload();
        } catch (err) {
          console.error("❌ Sign out error:", err);
          location.reload();
        }
      });
      console.log("✅ Logout button ready");
    }

    // Check session on load
    await checkUserSession(amplifyModule);
    console.log("✅ CloudSnap ready");

  } catch (error) {
    console.error("❌ Initialization error:", error);
    alert("Error initializing CloudSnap: " + error.message);
  }
});

// --- CORE APPLICATION UPLOAD & VIEW WORKFLOW ---

const API_GATEWAY_URL = "https://cco10loarj.execute-api.us-east-1.amazonaws.com";

// Get DOM elements after page loads
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

function showUploadSection() {
  if (uploadSection) {
    uploadSection.classList.remove("hidden");
    uploadSection.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function closeUploadSection() {
  if (uploadSection) {
    uploadSection.classList.add("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

if (showUploadBtn) showUploadBtn.addEventListener("click", showUploadSection);
if (startUploadBtn) startUploadBtn.addEventListener("click", showUploadSection);
if (closeUploadBtn) closeUploadBtn.addEventListener("click", closeUploadSection);

if (input) {
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;

    if (fileName) fileName.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (originalPreview) originalPreview.src = event.target.result;
      if (resizedPreview) resizedPreview.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

if (uploadBtn) {
  uploadBtn.addEventListener("click", async () => {
    const file = input?.files?.[0];

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
}

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
      alert('Image successfully uploaded to S3!');
    } else {
      const errorText = await s3Upload.text();
      console.error("S3 Upload Error:", errorText);
      alert(`S3 Upload failed with status: ${s3Upload.status}. Check console for details!`);
    }

  } catch (error) {
    console.error("Upload error:", error);
    alert(`An error occurred: ${error.message}`);
  }
}

async function retrieveProcessedImages() {
  try {
    console.log("Retrieving processed images...");
    
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