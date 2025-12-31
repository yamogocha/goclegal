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

export const caseResultsSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Case Results – GOC Legal",
    "description": "A selection of successful settlements, recoveries, and verdicts achieved by GOC Legal across personal injury, premises liability, motor vehicle collisions, wrongful death, and other civil matters.",
    "itemListElement": [
      {
        "@type": "LegalCase",
        "name": "$3,000,000 Victory – Premises Liability",
        "caseType": "Premises Liability",
        "description": "A hazardous staircase caused serious neck and back injuries. Through expert testimony and digital accident reconstruction, GOC Legal proved negligence and secured a $3,000,000 settlement.",
        "award": {
          "@type": "MonetaryAmount",
          "value": "3000000",
          "currency": "USD"
        }
      },
      {
        "@type": "LegalCase",
        "name": "$500,000 Recovery – Motor Vehicle Collision",
        "caseType": "Motor Vehicle Collision",
        "description": "A driver failed to yield and struck a pedestrian. Despite contested liability and causation, GOC Legal’s forensic investigation and trial preparation secured the full $500,000 policy limits.",
        "award": {
          "@type": "MonetaryAmount",
          "value": "500000",
          "currency": "USD"
        }
      },
      {
        "@type": "LegalCase",
        "name": "$325,000 Settlement – Premises Liability",
        "caseType": "Premises Liability",
        "description": "A 3-inch asphalt rise caused a mild traumatic brain injury. GOC Legal used medical analysis and expert testimony to prove causation and secure a $325,000 settlement.",
        "award": {
          "@type": "MonetaryAmount",
          "value": "325000",
          "currency": "USD"
        }
      },
      {
        "@type": "LegalCase",
        "name": "$300,000 Policy-Limit Recovery – Premises Liability",
        "caseType": "Premises Liability",
        "description": "A property owner caused a fall resulting in shoulder and neck injuries. Despite insurer challenges, neurosurgical consultation and detailed imaging proved causation, forcing the $300,000 policy-limit payout.",
        "award": {
          "@type": "MonetaryAmount",
          "value": "300000",
          "currency": "USD"
        }
      },
      {
        "@type": "LegalCase",
        "name": "$265,000 Settlement – Hit-and-Run Bicycle Collision",
        "caseType": "Bicycle Collision / Hit-and-Run",
        "description": "A ride-share driver fled the scene after striking a bicyclist. GOC Legal collaborated with police to identify the driver and secured $265,000 for the client’s arm injury.",
        "award": {
          "@type": "MonetaryAmount",
          "value": "265000",
          "currency": "USD"
        }
      },
      {
        "@type": "LegalCase",
        "name": "$230,000 Settlement – Unsafe Property Condition",
        "caseType": "Premises Liability",
        "description": "A 100-year-old client was injured due to a threshold that violated building code. Using ADA and code expertise, GOC Legal overcame age-based defenses and secured $230,000.",
        "award": {
          "@type": "MonetaryAmount",
          "value": "230000",
          "currency": "USD"
        }
      },
      {
        "@type": "LegalCase",
        "name": "$128,000 Settlement – Inadequate Lighting Injury",
        "caseType": "Premises Liability",
        "description": "Poor lighting in an apartment parking area caused a fall requiring elbow surgery. Despite comparative negligence arguments, GOC Legal’s expert evidence produced a $128,000 settlement.",
        "award": {
          "@type": "MonetaryAmount",
          "value": "128000",
          "currency": "USD"
        }
      },
      {
        "@type": "LegalCase",
        "name": "$120,000 Settlement – Hit-and-Run Pedestrian Collision",
        "caseType": "Pedestrian Injury / Hit-and-Run",
        "description": "A ride-share driver struck a pedestrian and fled. GOC Legal located the driver through surveillance and investigation, securing a $120,000 settlement despite disputed wage loss.",
        "award": {
          "@type": "MonetaryAmount",
          "value": "120000",
          "currency": "USD"
        }
      },
      {
        "@type": "LegalCase",
        "name": "$110,000 Settlement – Workplace Injury",
        "caseType": "Workplace Injury",
        "description": "A client tripped over exposed rebar, injuring his elbow. The insurer denied causation, but expert analysis connected the injury to the fall, resulting in a $110,000 settlement.",
        "award": {
          "@type": "MonetaryAmount",
          "value": "110000",
          "currency": "USD"
        }
      },
      {
        "@type": "LegalCase",
        "name": "$100,000 Policy-Limit Settlement – Rear-End Collision",
        "caseType": "Motor Vehicle Collision",
        "description": "A rear-end collision required knee arthroscopy. Despite insurer disputes, strong evidence forced the carrier to pay its full $100,000 policy limits.",
        "award": {
          "@type": "MonetaryAmount",
          "value": "100000",
          "currency": "USD"
        }
      },
      {
        "@type": "LegalCase",
        "name": "$100,000 Policy-Limit Settlement – Freeway Collision",
        "caseType": "Motor Vehicle Collision",
        "description": "A freeway collision resulted in neck injuries and embedded glass requiring surgery. Initial offers were only $7,500, but GOC Legal secured the full $100,000 policy limits.",
        "award": {
          "@type": "MonetaryAmount",
          "value": "100000",
          "currency": "USD"
        }
      },
      {
        "@type": "LegalCase",
        "name": "$100,000 Policy-Limit Settlement – Aggravated Spine Condition",
        "caseType": "Motor Vehicle Collision",
        "description": "A rear-end collision aggravated a pre-existing spinal condition. Neurosurgical experts supported causation, resulting in a $100,000 policy-limit recovery.",
        "award": {
          "@type": "MonetaryAmount",
          "value": "100000",
          "currency": "USD"
        }
      },
      {
        "@type": "LegalCase",
        "name": "$100,000 Settlement – Severe Hand Injury",
        "caseType": "Motor Vehicle Collision",
        "description": "A sideswipe collision caused a severe hand injury requiring surgery. GOC Legal built a strong medical case and obtained the full $100,000 policy limits.",
        "award": {
          "@type": "MonetaryAmount",
          "value": "100000",
          "currency": "USD"
        }
      },
      {
        "@type": "LegalCase",
        "name": "$100,000 Settlement – Premises Liability",
        "caseType": "Premises Liability",
        "description": "A hotel obstruction caused a knee injury. After insurer denial, GOC Legal used medical evidence and litigation strategy to secure a $100,000 settlement.",
        "award": {
          "@type": "MonetaryAmount",
          "value": "100000",
          "currency": "USD"
        }
      },
      {
        "@type": "LegalCase",
        "name": "$85,000 Recovery – Unsafe Trailer Collision",
        "caseType": "Motor Vehicle Collision",
        "description": "A rental company improperly secured a trailer, causing a collision. GOC Legal used expert testimony to prove liability and secured an $85,000 recovery.",
        "award": {
          "@type": "MonetaryAmount",
          "value": "85000",
          "currency": "USD"
        }
      },
      {
        "@type": "LegalCase",
        "name": "$80,000 Settlement – Pedestrian Impact at Gas Station",
        "caseType": "Pedestrian Injury",
        "description": "A pedestrian was struck at a gas station. Despite insurer denial, GOC Legal’s liability investigation secured an $80,000 settlement.",
        "award": {
          "@type": "MonetaryAmount",
          "value": "80000",
          "currency": "USD"
        }
      },
      {
        "@type": "LegalCase",
        "name": "$65,000 Settlement – Sideswipe Collision",
        "caseType": "Motor Vehicle Collision",
        "description": "A sideswipe collision caused a wrist ligament injury. Expert reconstruction and imaging evidence resulted in a $65,000 settlement.",
        "award": {
          "@type": "MonetaryAmount",
          "value": "65000",
          "currency": "USD"
        }
      },
      {
        "@type": "LegalCase",
        "name": "$61,000 Settlement – Grocery Store Fall",
        "caseType": "Premises Liability",
        "description": "A wet floor caused a wrist injury. GOC Legal proved the injury was new despite preexisting history, securing a $61,000 settlement.",
        "award": {
          "@type": "MonetaryAmount",
          "value": "61000",
          "currency": "USD"
        }
      },
      {
        "@type": "LegalCase",
        "name": "$55,000 Settlement – Unsafe Sidewalk",
        "caseType": "Premises Liability",
        "description": "An uneven city sidewalk caused facial injuries. Expert consultation and detailed reconstruction led to a $55,000 settlement.",
        "award": {
          "@type": "MonetaryAmount",
          "value": "55000",
          "currency": "USD"
        }
      },
      {
        "@type": "LegalCase",
        "name": "Confidential Settlement – Wrongful Death Claim (Jane Doe 1)",
        "caseType": "Wrongful Death",
        "description": "A negligent driver killed a pedestrian in a crosswalk. GOC Legal worked closely with law enforcement and secured the insurer’s full policy limits.",
        "award": "Confidential"
      },
      {
        "@type": "LegalCase",
        "name": "Confidential Settlement – Wrongful Death Claim (John Doe 1)",
        "caseType": "Wrongful Death",
        "description": "A fatal head-on collision required thorough investigation. GOC Legal proved civil liability and secured the at-fault party’s full policy limits.",
        "award": "Confidential"
      },
      {
        "@type": "LegalCase",
        "name": "Confidential Settlement – Wrongful Death Claim (John Doe 2)",
        "caseType": "Wrongful Death",
        "description": "A T-bone collision led to a wrongful death. Despite initial denial, evidence gathered by GOC Legal forced the insurer to pay full policy limits.",
        "award": "Confidential"
      }
    ]
  }
  

const BASE_URL = "https://www.goclegal.com";

export function buildPracticeAreaSchema(params: Record<string, string>) {
    const { title, description, slug, image } = params
   
    return {
        "@context": "https://schema.org",
        "@type": "Service",
        "name": title,
        description,
        image,
        "provider": {
            "@type": "LegalService",
            "name": "GOC Legal",
            "url": "https://www.goclegal.com"
        },
        "areaServed": {
            "@type": "City",
            "name": "Oakland"
        },
        "url": `${BASE_URL}/${slug}`
    }
};

export function buildBlogSchema(params: Record<string, string>) {
  const { title, description, slug, image, date } = params

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    title,
    description,
    image,
    author: {
      "@type": "Person",
      "name": "GOC Legal"
    },
    publisher: {
      "@type": "Organization",
      name: "GOC Legal",
      logo: {
        "@type": "ImageObject",
        "url": "https://goclegal.com/logo.png"
      }
    },
    datePublished: date,
    dateModified: date,
    mainEntityOfPage: `https://goclegal.com/blog/${slug}`
  };
}

export function buildPageMetadata(params: Record<string, string>) {
    const { title, description, slug, image } = params
    const url = `${BASE_URL}/${slug}`;

    return {
        title: `${title} | GOC Legal `,
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
            images: [image],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [image],
        },
    };
}