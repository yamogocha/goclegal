"use client"
import imageUrlBuilder from '@sanity/image-url'
import { client } from '@/sanity/client'
import { useEffect, useState } from 'react'

const builder = imageUrlBuilder(client)

export function urlFor(source: Record<string, unknown>){
    return builder.image(source)
}


export function useIsMobile(breakpoint = 768): boolean | null {
    const [isMobile, setIsMobile] = useState<boolean | null>(null)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= breakpoint)
        checkMobile()
        window.addEventListener("resize", checkMobile)
        return () => window.removeEventListener("resize", checkMobile)
    }, [breakpoint])

    return isMobile
}

async function notifySlackAlerts(message: string) {
    if (!process.env.SLACK_ALERTS_URL) return;
  
    await fetch(process.env.SLACK_ALERTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: message,
      }),
    });
  }

  async function notifySlackReports(message: string) {
    if (!process.env.SLACK_REPORTS_URL) return;
  
    await fetch(process.env.SLACK_REPORTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: message,
      }),
    });
  }

  export function getErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.stack || err.message;
    }
  
    if (typeof err === "string") {
      return err;
    }
  
    try {
      return JSON.stringify(err, null, 2);
    } catch {
      return String(err);
    }
  }
  
  export async function notifySlackError(
    title: string,
    err: unknown,
    extra?: Record<string, unknown>
  ) {
    const payload = {
      title,
      error: getErrorMessage(err),
      timestamp: new Date().toISOString(),
      ...extra,
    };
  
    console.error(`[${title}]`, payload);
  
    try {
      await notifySlackAlerts(
        `❌ ${title}\n\n${JSON.stringify(payload, null, 2)}`
      );
    } catch (slackErr) {
      console.error(
        "[SLACK ALERTS NOTIFICATION ERROR]",
        getErrorMessage(slackErr)
      );
    }
  }

  export async function notifySlackResult(
    title: string,
    result: unknown,
    extra?: Record<string, unknown>
  ) {
    const payload = {
      title,
      result,
      timestamp: new Date().toISOString(),
      ...extra,
    };
  
    console.error(`[${title}]`, payload);
  
    try {
      await notifySlackReports(
        `✅ ${title}\n\n${JSON.stringify(payload, null, 2)}`
      );
    } catch (slackErr) {
      console.error(
        "[SLACK REPORTSNOTIFICATION ERROR]",
        getErrorMessage(slackErr)
      );
    }
  }