export const attorneySchema = {
"@context": "https://schema.org",
"@type": "Person",
"name": "Gregory OConnell",
"jobTitle": "Personal Injury Attorney",
"image": "https://cdn.sanity.io/images/3zonvthd/production/b8dd1ce3b6f2ca364579a5e5ac4f5f5907b184b2-3024x4032.jpg",
"worksFor": {
    "@type": "LegalService",
    "name": "GOC Legal"
},
"sameAs": [
    "https://www.linkedin.com/in/gregory-o-connell-a89ba43a/"
],
"description": "Gregory OConnell specializes in personal injury cases in Oakland, CA."
};

export const faqSchema = {
"@context": "https://schema.org",
"@type": "FAQPage",
"mainEntity": [
    {
    "@type": "Question",
    "name": "How much does a personal injury consultation cost?",
    "acceptedAnswer": {
        "@type": "Answer",
        "text": "GOC Legal offers free consultations for personal injury cases."
    }
    },
    {
    "@type": "Question",
    "name": "Does GOC Legal work on a contingency basis?",
    "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, GOC Legal charges zero upfront fees and works on a contingency basis."
    }
    }
]
};

export const homepageSchema = {
"@context": "https://schema.org",
"@type": "LegalService",
"name": "GOC Legal",
"url": "https://www.goclegal.com",
"logo": "https://www.goclegal.com/logo.png",
"image": "https://www.goclegal.com/og-default.jpg",
"description": "GOC Legal is a trusted Oakland personal injury and auto accident law firm. Zero upfront fees, maximum compensation, and free consultations.",
"telephone": "+1-510-846-0928",
"address": {
    "@type": "PostalAddress",
    "streetAddress": "10 Villanova Drive",
    "addressLocality": "Oakland",
    "addressRegion": "CA",
    "postalCode": "94611",
    "addressCountry": "US"
},
"areaServed": "Oakland",
"openingHours": "Mo-Fr 09:00-17:00",
"sameAs": [
    "https://www.facebook.com/goclegal",
    "https://www.linkedin.com/company/goclegal",
    "https://www.instagram.com/goclegalpc/"
]
};

export const testimonialSchema = {
"@context": "https://schema.org",
"@type": "LegalService",
"name": "GOC Legal",
"aggregateRating": {
  "@type": "AggregateRating",
  "ratingValue": "5",
  "ratingCount": "4"
},
"review": [
    {
    "@type": "Review",
    "author": { "@type": "Person", "name": "Grace Lee" },
    "reviewBody": "I was scared and confused after my injury, but GOC Legal gave me peace of mind. They listened, cared, and fought for me. It wasn’t just about the money. It was about justice and being treated with respect. I’ll always be grateful.",
    },
    {
    "@type": "Review",
    "author": { "@type": "Person", "name": "Brendon Smith" },
    "reviewBody": "After my accident, I was overwhelmed and didn’t know where to start. The team at GOC Legal took care of everything, from dealing with the insurance company to getting me the settlement I deserved. They treated me like family, not just another case. Highly recommend!",
    }
]
};

const BASE_URL = "https://www.goclegal.com";

function getPageParams(slug: string) {
    switch(slug) {
        case "auto-accidents":
            return autoAccidentsParams;
        case "bicycle-accidents":
            return bicycleAccidentsParams;
        case "trucking-accidents":
            return truckingAccidentsParams;
        case "construction-site-accidents":
            return constructionAccidentsParams;
        case "wrongful-death":
            return wrongfulDeathParams;
        case "slip-and-fall-injuries":
            return slipFallParams;
        case "traumatic-brain-injury":
            return traumaticBrainInjuryParams;
        case "about":
            return aboutParams;
        case "privacy-policy":
            return privacyPolicyParams;
        case "faqs":
            return faqsParams
        default:
            return autoAccidentsParams;
    }
}

export function buildPracticeAreaSchema(slug: string) {
    const params = getPageParams(slug)
    const { title, description, path } = params
   
    return {
        "@context": "https://schema.org",
        "@type": "Service",
        "name": title,
        "description": description,
        "provider": {
            "@type": "LegalService",
            "name": "GOC Legal",
            "url": "https://www.goclegal.com"
        },
        "areaServed": {
            "@type": "City",
            "name": "Oakland"
        },
        "url": `${BASE_URL}/${path}`
    }
};

export function buildPageMetadata(slug: string) {
    const params = getPageParams(slug)
    const { title, description, path } = params
    const url = `${BASE_URL}/${path}`;

    return {
        title,
        description,
        alternates: { 
            canonical: url 
        },
        openGraph: {
            title,
            description,
            url,
            siteName: "GOC Legal",
            type: "website",
            // images: [image.startsWith("http") ? image : `${BASE_URL}${image}`],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            // images: [image.startsWith("http") ? image : `${BASE_URL}${image}`],
        },
    };
}

const autoAccidentsParams = {
    title: "Auto Accidents | GOC Legal",
    description: "Experienced California auto accident attorneys fighting for maximum compensation after injuries. Get trusted legal help and a free case evaluation.",
    path: "auto-accidents"
};

const bicycleAccidentsParams = {
    title: "Bicycle Accidents | GOC Legal",
    description: "Hurt in a bicycle accident? We protect injured cyclists and fight for compensation for medical bills, lost wages, and pain and suffering.",
    path: "bicycle-accidents"
};

const truckingAccidentsParams = {
    title: "Trucking Accidents | GOC Legal",
    description: "Serious injuries from a truck accident? We take on trucking companies and insurers to secure the compensation you deserve.",
    path: "trucking-accidents"
};

const constructionAccidentsParams = {
    title: "Construction Site Accidents | GOC Legal",
    description: "Injured on a construction site? Our attorneys handle workplace injury claims and fight for compensation beyond workers’ compensation benefits.",
    path: "construction-site-accidents"
};

const wrongfulDeathParams = {
    title: "Wrongful Death | GOC Legal",
    description: "Supporting families after a wrongful death with compassionate, determined legal representation. We pursue justice and maximum compensation.",
    path: "wrongful-death"
};

const slipFallParams = {
    title: "Slip and Fall Injuries | GOC Legal",
    description: "Injured in a slip and fall? Our premises liability lawyers hold negligent property owners accountable. Get expert guidance and a free consultation.",
    path: "slip-and-fall-injuries"
};

const traumaticBrainInjuryParams = {
    title: "Traumatic Brain Injury | GOC Legal",
    description: "Compassionate legal support for traumatic brain injury victims. We help you secure medical care and full compensation for long-term recovery.",
    path: "traumatic-brain-injury"
};

const aboutParams = {
    title: "About | GOC Legal",
    description: "Learn about GOC Legal’s mission, values, and dedication to protecting injured individuals across California with skilled, aggressive representation.",
    path: "about"
}

const privacyPolicyParams = {
    title: "Privacy Policy | GOC Legal",
    description: "Review GOC Legal’s privacy policy to learn how we protect your personal information and keep your data secure.",
    path: "privacy-policy"
}

const faqsParams = {
    title: "FAQS | GOC Legal",
    description: "Answers to common personal injury questions. Learn what to expect after an accident, how claims work, and how GOC Legal can help you.",
    path: "faqs"
}