const cron= require('node-cron');
const emailService= require('../services/email-service')
const sender=require('../config/email-config')
/**
 * 
 * every 5 minutes we will check what all emails are expected to be send by
 * now and is pending
 * we will just send those email
 */


// const setUpJobs= ()=>{
//   cron.schedule('*/1 * * * *',async ()=>{
// const response= await emailService.fetchPendingEmails();
//    response.forEach((email) => {
//     emailService.sendBasicEmail("Remainderservice@airline.com",email.recepientEmail,email.subject,email.content)
    
//    });
//   })
// }
const setUpJobs = () => {
  cron.schedule('*/1 * * * *', async () => {
      const response = await emailService.fetchPendingEmails();
      console.log(response);
      response.forEach((email) => {
          sender.sendMail({
              to: email.recepientEmail,
              subject: email.subject,
              text: email.content
          }, async (err, data) => {
              if(err) {
                  console.log(err);
              } else {
                  console.log(data);
                  await emailService.updateTicket(email.id, {status: "SUCCESS"});
              }
          });
      });
      console.log(response);
  });    
}

module.exports=setUpJobs;