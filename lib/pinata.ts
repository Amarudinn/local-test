import { toast } from "sonner";

const PINATA_API_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

/**
 * Uploads a file to IPFS via Pinata
 * @param file The file object to upload
 * @returns The IPFS URL of the uploaded file
 */
export async function uploadToPinata(file: File): Promise<string | null> {
    const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;

    if (!jwt) {
        console.error("Pinata JWT is missing");
        toast.error("Image upload configuration is missing");
        return null;
    }

    try {
        const formData = new FormData();
        formData.append("file", file);

        // Optional: Add metadata
        const metadata = JSON.stringify({
            name: `debate-cover-${Date.now()}`,
        });
        formData.append("pinataMetadata", metadata);

        // Optional: Add options
        const options = JSON.stringify({
            cidVersion: 1,
        });
        formData.append("pinataOptions", options);

        const res = await fetch(PINATA_API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${jwt}`,
            },
            body: formData,
        });

        if (!res.ok) {
            throw new Error(`Pinata upload failed: ${res.statusText}`);
        }

        const data = await res.json();
        return `${PINATA_GATEWAY}${data.IpfsHash}`;
    } catch (error) {
        console.error("Error uploading to Pinata:", error);
        toast.error("Failed to upload image");
        return null;
    }
}

/**
 * Generates a consistent gradient color based on a string (e.g., topic)
 */
export function generateGradient(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    const c1 = (hash & 0x00ffffff).toString(16).toUpperCase();
    const c2 = ((hash * 123) & 0x00ffffff).toString(16).toUpperCase();

    const color1 = "#" + "00000".substring(0, 6 - c1.length) + c1;
    const color2 = "#" + "00000".substring(0, 6 - c2.length) + c2;

    return `linear-gradient(135deg, ${color1} 0%, ${color2} 100%)`;
}
