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
  if (file) {
    await uploadImage(file);  // Pass the file directly
  }

  steps.forEach(step => step.classList.remove("active"));

  steps.forEach((step, index) => {
    setTimeout(() => {
      step.classList.add("active");
    }, index * 700);
  });
});

async function uploadImage(file) {
    if (!file) return alert('Please select a file first.');

    try {
        // 1. Ask your HTTP API (via Lambda) for an upload pass
        // Notice we target the specific route path we designed: /get-presigned-url
        const apiResponse = await fetch(`${API_GATEWAY_URL}/get-presigned-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: file.name,
                fileType: file.type
            })
        });

        if (!apiResponse.ok) {
            throw new Error(`API Gateway error: ${apiResponse.statusText}`);
        }
        
        // Extract the target S3 upload URL string sent back by Lambda
        const data = await apiResponse.json();
        const s3PresignedUrl = data.uploadUrl;

        // 2. Send the raw binary file directly to S3 using PUT
        // This replaces the complex FormData loop and completely avoids the 405 error
        const s3Upload = await fetch(s3PresignedUrl, {
            method: 'PUT',
            headers: {
                'Content-Type' : file.type,
                'x-amz-server-side-encryption': 'aws:kms',
                'x-amz-server-side-encryption-aws-kms-key-id': 'arn:aws:kms:us-east-1:337763382699:key/photo-sharing-app-key'
            },
            body: file // Uploading the raw file object directly
        });

        if (s3Upload.ok) {
            alert('Image successfully uploaded straight to S3!');
        } else {
            // READ THE RAW ERROR TEXT INSTEAD OF LETTING THE INSPECTOR EVICT IT
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