interface attachment {
  "@odata.type": "#microsoft.graph.fileAttachment",
  "name": string,
  "contentType": string,
  "contentBytes": string
}

interface recipient {
  emailAddress: {address: string}
}

export interface GraphMailPayload {
  "senderMail": string,
  "message": {
    "subject": string,
    "body": {
      contentType: "HTML" | "Text";
      "content": string
    },
    "toRecipients": recipient[],
    "ccRecipients": recipient[],
    "attachments"?: attachment[]
  },
  "saveToSentItems": boolean
}

export interface ApiResponse {
  "ok": boolean,
  "message": string,
  "graph": {
      "id": string,
      "internetMessageId": string,
      "conversationId": string,
      "webLink": string,
      "createdDateTime": string
      "lastModifiedDateTime": string,
      "subject": string,
    }
}