"use server"

import { changeAvatar, changeUsername, getUserById, initiateEmailChange, softDeleteAccount } from "@/services/userService";




export async function changeUsernameAndEmail(formData: any) {
   
    try {
        const customer = transformFormData(formData);
        const foundUser = await getUserById(customer.id);
        if(!foundUser) {
            return {userNotFound: true}
        }
        
        
        let isUsernameChanged = false;
        if(customer.newUsername !== foundUser?.username) {
            const changedInfo = await changeUsername(foundUser.id, customer.newUsername);
            if(changedInfo) {
                isUsernameChanged = true;
            }
        }
        
        
        let isEmailedChangeInitiated = false;
        if(customer.newEmail !== foundUser?.email) {
            const initiated = await initiateEmailChange(foundUser.id, customer.newEmail);
            if(initiated) {
                isEmailedChangeInitiated = true;
            }
        }
        
        return {isUsernameChanged, isEmailedChangeInitiated};
    
    } catch (error) {
        console.error("unexpted error orcoured changing ",error);
        throw error;
    }   
}

function transformFormData(formData: any) {
    const formDataObject = {
        newUsername: formData.newUsername as string,
        newEmail: formData.newEmail as string,
        id: formData.customerId as string
    }

    return formDataObject;
}






export async function saveAvatarUrlAction(userId: string, avatarUrl: string) {
    try {
        const updatedCustomer = await changeAvatar(userId, avatarUrl);
        return updatedCustomer;

    } catch(error) {
        console.error(error);
        throw error;
    }
}






export async function softDeleteAccountAction(userId: string) {
    try {
        const success = await softDeleteAccount(userId);
        if(!success) {
            throw new Error(`failed to soft delete account with user id: ${userId}`);
        }

        return success;

    }catch(error) {
        console.error(`(server action) failed to delete user with id: ${userId}`,error);
        throw error;
    }
}
