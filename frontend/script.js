import { Amplify } from 'https://cdn.jsdelivr.net/npm/aws-amplify@6/dist/esm/index.js';
import { fetchAuthSession } from 'https://cdn.jsdelivr.net/npm/aws-amplify@6/auth/dist/esm/index.js';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_BILlNM20K',
      userPoolClientId: '3s19gm75adqtebvq0p8bgbta8a' 
    }
  }
});

const input = document.getElementById("imageInput");
// Note: You can delete the usernameInput element from your HTML entirely now!
const fileName = document.getElementById("fileName");
const uploadBtn = document.getElementById("uploadBtn");
const steps = document.querySelectorAll(".step");
const originalPreview = document.getElementById("originalPreview");
const resizedPreview = document.getElementById("resizedPreview");
const uploadSection = document.getElementById("upload");
const showUploadBtn = document.getElementById("showUploadBtn");
const startUploadBtn = document.getElementById("startUploadBtn");
const closeUploadBtn = document.getElementById("closeUploadBtn");
const API_GATEWAY_URL = "https://cco10loarj.execute-api.us-east-1.amazonaws.com";

function showUploadSection() {
  uploadSection.classList.remove("hidden");
  uploadSection.scrollIntoView({ behavior: "smooth", block: "center" });
}

function closeUploadSection() {
  uploadSection.classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

showUploadBtn.addEventListener("click", showUploadSection);
startUploadBtn.addEventListener("click", showUploadSection);
closeUploadBtn.addEventListener("click", closeUploadSection);

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

  // Identity is implicitly extracted via the session token now
  await uploadImage(file);  

  steps.forEach(step => step.classList.remove("active"));

  steps.forEach((step, index) => {
    setTimeout(() => {
      step.classList.add("active");
    }, index * 700);
  });
  
  // After animation completes, retrieve processed images securely
  setTimeout(() => {
    retrieveProcessedImages();
  }, 3800);
});

async function uploadImage(file) {
    if (!file) return alert('Please select a file first.');

    try {
        // 1. Fetch your verified Cognito token
        const token = await getCognitoToken();
        if (!token) return;

        // 2. Ask API Gateway for an upload pass
        const apiResponse = await fetch(`${API_GATEWAY_URL}/get-presigned-url`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Pass token to your authorizer
            },
            body: JSON.stringify({
                fileName: file.name,
                fileType: file.type
                // No longer sending user_id in the body! Lambda reads it from context
            })
        });

        if (!apiResponse.ok) {
            throw new Error(`API Gateway error: ${apiResponse.statusText}`);
        }
        
        const data = await apiResponse.json();
        const s3PresignedUrl = data.uploadUrl;

        // 3. Send the raw binary file directly to S3 using PUT
        const s3Upload = await fetch(s3PresignedUrl, {
            method: 'PUT',
            headers: {
                'Content-Type' : file.type,
                'x-amz-server-side-encryption': 'aws:kms',
                'x-amz-server-side-encryption-aws-kms-key-id': 'arn:aws:kms:us-east-1:337763382699:key/2a0566eb-80cb-4a5b-be8c-bdd6abfe5b03'
                // S3 metadata tags aren't required anymore because your DB retrieval is completely locked down
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
        
        // 1. Fetch your verified Cognito token
        const token = await getCognitoToken();
        if (!token) return;

        // 2. Query endpoint directly. Notice: NO QUERY STRINGS!
        const response = await fetch(`${API_GATEWAY_URL}/get-processed-images`, {
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // The token carries the identity
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