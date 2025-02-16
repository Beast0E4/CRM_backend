const Ticket = require('../models/ticket.model');
const User = require('../models/user.model');
const UserService = require('./user.service');
const sendNotification = require('../Utils/notificationServiceClient');

const createTicket = async(data, userData) =>{
    try{
        const validAssignedTo =  await UserService.getValidActiveUser();
        console.log("val", validAssignedTo)
        if(validAssignedTo.error){
            return {
                error:{
                    assignedTo: validAssignedTo.error 
                }
            }
        }
        
        const ticketObj = {
            title: data.title,
            description: data.description,
            status: data.status,
            ticketPriority: data.ticketPriority,
            assignee:userData.email, // NM
            assignedTo:validAssignedTo.email,
            clientName:data.clientName,
            createdBy: userData.email,  // NM
        }
        const ticketResponse = await Ticket.create(ticketObj);
        if(ticketResponse){
            //store this ticket for user too
            const userResponse = await UserService.addNewTicketCreatedByUser(userData.email, ticketResponse._id);
            if( userResponse.error){
                return {
                    error: userResponse.error
                }
            }
            console.log(validAssignedTo.email);
            if(validAssignedTo.email) {
                const response = await UserService.addTicketAssignedToUser(validAssignedTo.email, ticketResponse._id);
                if( response.error){
                    return {
                        error: response.error
                    }
                }
            }
            const sendNotificationEmailObject = {
                subject: "A new ticket is created: " + ticketResponse.title, 
                content: "Ticket Description : " + ticketResponse.description, 
                recepientEmails: [ticketResponse.createdBy, ticketResponse.assignedTo], 
                requester: ticketResponse.createdBy, 
                ticketId: ticketResponse._id
            }
            sendNotification(sendNotificationEmailObject.subject, sendNotificationEmailObject.content, 
                sendNotificationEmailObject.recepientEmails, sendNotificationEmailObject.requester, sendNotificationEmailObject.ticketId);

            return ticketResponse;
        }
        else{
            return {
                error: "server error occurred"
            }
        }
    }
    catch(err){
        console.log(err);
        return err.message;
    }
}

const getOneTicket = async(data) => {
    try{
        const response =  await UserService.validateTicketId(data.id);
        if( response.error){
            return {
                error: response.error
            }
        }
        return response;
    }
    catch(err){
        console.log(err);
        return err.message;
    }

}

const getAllTicktes = async(userInfo) =>{
    try{
        var response;
        if(userInfo.userType === "customer"){
            response = await Ticket.find({clientName: userInfo.clientName});
            return response;
        }
        response = await Ticket.find();
        return response;
    }
    catch(err){
        console.log(err);
        return err.message;
    }
}

const getAllTicketsByStatus = async(data) =>{
    try{
        const response = await Ticket.find({status: data.status});
        return response;
    }
    catch(err){
        console.log(err);
        return err.message;
    }
}

const updateTicketById = async(ticketIdInfo, ticketInfo, currentUser) =>{
    try{
        const validateTicket = await UserService.validateTicketId(ticketIdInfo.id);
        if(!validateTicket || validateTicket.error){
            return {
                error: "invalid ticket id"
            }
        }

        const filter = { _id: ticketIdInfo.id };
        const update = ticketInfo;
        console.log(currentUser, update, validateTicket);

        console.log(validateTicket.assignedTo != currentUser.email, validateTicket.assignee != currentUser.email)
        if(validateTicket.assignedTo !== currentUser.email && validateTicket.assignee !== currentUser.email) {
            if(currentUser.userType !== "admin" ) {
                return {
                    error: `Invalid assignedTo user`
                }
            }
        }
            
        //previousAssignedToUser
        await User.findOneAndUpdate({email:validateTicket.assignedTo}, {
            $pull:{
                ticketsAssigned: validateTicket._id
            }
        })

        //newAssignedToUser 
        await User.findOneAndUpdate({email:update.assignedTo}, {
            $push:{
                ticketsAssigned: validateTicket._id
            }
        })

        const response = await Ticket.findOneAndUpdate(
            filter, 
            update,
            {
                new: true // return the updated document
            }
        );

        // const sendNotificationEmailObject = {
        //     subject: "A ticket is updated: " + response.title, 
        //     content: "Ticket Description : " + response.description, 
        //     recepientEmails: [response.createdBy, response.assignedTo], 
        //     requester: response.createdBy, 
        //     ticketId: response._id
        // }

        // sendNotification(sendNotificationEmailObject.subject, sendNotificationEmailObject.content, 
        //     sendNotificationEmailObject.recepientEmails, sendNotificationEmailObject.requester, sendNotificationEmailObject.ticketId);

        return response;
    }
    catch(err){
        console.log(err);
        return err.message;
    }
}

module.exports = {createTicket, getOneTicket, getAllTicktes, getAllTicketsByStatus,updateTicketById};