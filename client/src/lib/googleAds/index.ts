import { GoogleAdsApi } from "google-ads-api";

const googleAdsClient = new GoogleAdsApi({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
  });
  
  export function getCustomer() {
    return googleAdsClient.Customer({
      customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID!,
      login_customer_id: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
    });
  }