import cloudinary from "../config/cloudinary.js";

export const uploadToCloudinary = async ( buffer, folder, options = {} ) => {
    return await new Promise( (resolve, reject) => {
        cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: "image",
                ...options         //controller spesific config like croping images.
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        ).end(buffer);
    });
};