import cloudinary from "../config/cloudinary.js";

export const uploadToCloudinary = async (buffer, folder) => {
    return await new Promise( (resolve, reject) => {
        cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: "image",
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        ).end(buffer);
    });
};