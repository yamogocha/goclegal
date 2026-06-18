export function buildPlaintiffAttorneyLines(plaintiffName: string) {
  return [
    {
      text: "Gregory O'Connell Esq. (SBN #263221)\nGOC LEGAL, PC",
      stacked: true,
    },
    {
      text: "10 Villanova Drive\nOakland, CA 94611",
      stacked: true,
    },
    {
      text: "Telephone: (510) 846-0928\nEmail: oconnell.gregory@gmail.com",
      stacked: true,
    },
    { text: "" },
    {
      text: `Attorneys for,\n${plaintiffName.toUpperCase()}`,
      stacked: true,
    },
    { text: "" },
  ];
}

export function buildCourtTitle() {
  return [
    { text: "SUPERIOR COURT OF THE STATE OF CALIFORNIA", center: true, bold: true },
    { text: "FOR THE COUNTY OF ALAMEDA", center: true, bold: true },
    { text: "" },
  ];
}

export function buildPlaintiffCaptionLines(
  plaintiffName: string,
  defendantName: string
) {
  return [
    { text: `${plaintiffName.toUpperCase()}`, stacked: true },
    { text: "Plaintiffs," },
    { text: "vs." },
    { text: `${defendantName.toUpperCase()}`, stacked: true },
    { text: "Defendants." },
    // don't remove these two empty lines it creates empty page in the doc
    { text: "" },
    { text: "" },
  ];
}

export function buildPlaintiffCaptionRightLines(caseNumber: string, documentTitle: string) {
  const words = documentTitle.trim().split(/\s+/);
  const titleLines: string[] = [];

  for (let i = 0; i < words.length; i += 3) {
    titleLines.push(words.slice(i, i + 3).join(" "));
  }

  const stackedTitle = titleLines.join("\n");

  return [
    { text: `Case No.: ${caseNumber}`, stacked: true },
    { text: "" },
    { text: stackedTitle, stacked: true },
  ];
}

export function buildIntroLines(
  plaintiffName: string,
  defendantName: string,
  setNumber: string
) {
  return [
    { text: `PROPOUNDING PARTY: ${plaintiffName}` },
    { text: `RESPONDING PARTY: ${defendantName}` },
    { text: `SET NUMBER: ${setNumber}` },

    { text: " Pursuant to Code of Civil Procedure section 2030.210, et seq, Responding Party responds", firstLine: true },
    { text: "to Propounding Party’s Special Interrogatories, Set No. one, as follows:" },

    { text: " This responding party and his counsel have not completed their discovery or preparation", firstLine: true },
    { text: "for trial nor have they completed their analysis and review of the investigation and other trial" },
    { text: "preparation matters, and subjects obtained or conducted to date. These responses therefore state" },
    { text: "the present information and analysis of the responding party and his counsel as acquired and" },
    { text: "reviewed to date without prejudice to this responding party's right to present additional facts," },
    { text: "contentions or theories at trial based upon information, evidence or analysis hereafter obtained or" },
    { text: "evaluated. The following responses state the information, facts, evidence and contentions known" },
    { text: "to and evaluated by this responding party and his counsel." },

    { text: " This responding party further hereby provides the following responses without prejudice", firstLine: true },
    { text: "to further discovery and specifically reserves the right to present subsequently discovered" },
    { text: "evidence at trial of this action." },

    { text: " Each of the following responses and answers is rendered and based upon information in", firstLine: true },
    { text: "the possession of the responding party at the time of the preparation of these answers after" },
    { text: "diligent inquiry. Discovery will continue as long as permitted by statute or stipulation of the" },
    { text: "parties and the investigation of this responding party's attorneys and agents will continue to and" },
    { text: "throughout the trial of this action. This responding party therefore specifically reserves the right" },
    { text: "at the time of trial to introduce any evidence from any source which may hereafter be discovered" },
    { text: "and testimony from any witnesses whose identities may hereafter be discovered." },

    { text: " If any information has unintentionally been omitted from these responses, the interrogated", firstLine: true },
    { text: "party reserves the right to apply for relief so as to permit the insertion of the omitted data from" },
    { text: "these responses. This responding party has made every effort to obtain documentation necessary" },
    { text: "to respond to these interrogatories. These introductory comments shall apply to each and every" },
    { text: "answer given herein and shall be incorporated by reference as though fully set forth in all of the" },
    { text: "interrogatory responses appearing on the following pages. Finally, as some of these responses" },
    { text: "may have been ascertained by this responding party's attorneys and investigators, this responding" },
    { text: "party may not have personal knowledge of the information from which these responses are" },
    { text: "derived." },

    { text: " To the extent that any of these interrogatories call for responses which are protected by", firstLine: true },
    { text: "the attorney/client and/or attorney work product privileges, this responding party objects to said" },
    { text: "interrogatories on that basis." },

    { text: " To the extent that any of these interrogatories call for responses which are of a", firstLine: true },
    { text: "confidential and proprietary nature as protected by the United States Constitution and/or the" },
    { text: "California Constitution, this responding party objects to said interrogatories on that basis." },

    { text: " To the extent that any of the interrogatories call for responses which are protected by any", firstLine: true },
    { text: "additional privileges, this responding party objects to the answering of said interrogatories on" },
    { text: "that basis." },

    { text: "" },
    { text: "" },
  ];
}

export function buildFormInterrogatoryIntroLines(
  plaintiffName: string,
  defendantName: string,
  setNumber: string
) {
  return [
    { text: `PROPOUNDING PARTY: ${defendantName}` },
    { text: `RESPONDING PARTY: ${plaintiffName}` },
    { text: `SET NUMBER: ${setNumber}` },

    { text: 'Plaintiff (“Plaintiff” and/or “Responding Party”) hereby responds to Form Interrogatories', firstLine: true },
    { text: '(Set one) propounded by Defendant ("Defendant" and/or "Propounding Party") as follows:' },

    { text: "PRELIMINARY STATEMENT", center: true, bold: true },

    { text: " These responses are made solely for the purpose of this litigation. Each response is subject", firstLine: true },
    { text: "to all appropriate objections, including but not limited to, objections concerning competency," },
    { text: "relevancy, materiality, form, and privilege that would require the exclusion of any statement if the" },
    { text: "interrogatory was asked of, or any statement was made by, a witness testifying in court." },
    { text: "Consequently, all such objections are reserved and may be interposed at time of trial." },

    { text: "Responding Party is furnishing information responsive to this demand as is presently", firstLine: true },
    { text: "available to her. Such information may include hearsay and other forms of evidence that are neither" },
    { text: "admissible nor reliable. The responses are given without prejudice to producing at trial subsequently" },
    { text: "discovered information omitted from the answers as a result of good faith oversight." },

    { text: " The party on whose behalf answers are given has not completed her investigation of the facts", firstLine: true },
    { text: "relating to this litigation and has not completed discovery or trial preparation. Consequently, the" },
    { text: "following responses are given without prejudice to amend, supplement, or modify and are subject to" },
    { text: "Responding Party’s right to produce, at the time of trial or at any time during these proceedings," },
    { text: "subsequently discovered evidence relating to the proof of currently known material facts and all" },
    { text: "evidence, wherever discovered, relating to the proof of subsequently-discovered material facts." },

    { text: "The Responding Party objects, and does not intend to produce any evidence which may be" },
    { text: "protected by the privileges against self-incrimination (Evidence Code § 940), attorney-client" },
    { text: "(Evidence Code §950), spousal communication (Evidence Code §980), physician-patient" },
    { text: "(Evidence Code §930), psychotherapist-patient (Evidence Code §1010), educational" },
    { text: "psychologist-patient (Evidence Code §1010.5), and official records (Evidence Code §1040)." },
    { text: "This is a continuing objection throughout these responses." },

    { text: "GENERAL OBJECTIONS", center: true, bold: true },

    { text: "Responding Party sets forth below its general objections. These general objections are", firstLine: true },
    { text: "hereby incorporated by reference into each specific response." },

    { text: "Any response and/or specific objection is made without waiver of these general objections", firstLine: true },
    { text: "to propounding party’s requests." },

    { text: "1. Responding Party objects to the requests to the extent they require Responding Party to", firstLine: true },
    { text: "explain fully the legal and factual basis for her contentions and otherwise set forth all information" },
    { text: "pertaining to those contentions when the parties are at the outset of litigation and discovery are not" },
    { text: "yet complete." },

    { text: "2. Responding Party objects to the requests to the extent they improperly call for the disclosure", firstLine: true },
    { text: "of opinions, mental impressions, conclusions, legal research or legal theories of Responding Party’s" },
    { text: "counsel, or to the extent they call for the disclosure of other information prepared in anticipation of" },
    { text: "litigation that is protected under Code of Civil Procedure § 2018 and applicable case law." },

    { text: "3. Responding Party objects to the requests to the extent they call for the disclosure of", firstLine: true },
    { text: "information protected by the attorney-client privilege.  Responding Party will not disclose such" },
    { text: "information." },

    { text: "4. Responding Party objects to the requests to the extent they seek information not relevant or", firstLine: true },
    { text: "material to the substantive issues raised by this lawsuit under applicable law and are not reasonably" },
    { text: "calculated to lead to the discovery of admissible evidence." },

    { text: "5. Responding Party objects to the requests to the extent that they seek disclosure of", firstLine: true },
    { text: "information already in the possession of Propounding Party or information that is equally available" },
    { text: "to Propounding Party, either as a matter of public record or by direct contact with the source of the" },
    { text: "information." },

    { text: "6. Responding Party objects to the requests to the extent they are so vague, unduly burdensome,", firstLine: true },
    { text: "ambiguous, and overly broad in the context of this action as to render them impossible to respond" },
    { text: "to in any reasonable manner or amount of time or at any reasonable cost." },

    { text: "7. Responding Party objects to the requests to the extent that they call for disclosure of", firstLine: true },
    { text: "information not in Responding Party’s possession, custody or control." },

    { text: "8. Responding Party objects to the requests to the extent they assume facts that are not in", firstLine: true },
    { text: "evidence." },

    { text: "9. Responding Party objects to the requests to the extent they seek information that violates", firstLine: true },
    { text: "Responding Party’s right to privacy under applicable state and/or federal law." },

    { text: "10. Responding Party objects to the requests to the extent they seek information from persons", firstLine: true },
    { text: "outside the custody or control of Responding Party." },

    { text: "Notwithstanding these or any other objections, Responding Party responds to Form", firstLine: true },
    { text: "Interrogatories (Set one) as follows:" },

    { text: "" },
    { text: "" },
  ];
}

export function buildInterrogatoryResponseLines(
  isSpecial: boolean,
  number: string,
  question: string,
  response: string,
  questionLines: string[] = [],
) {
  const questionBlocks = isSpecial ? [{ text: question, firstLine: true }] : [...(question ? [{ text: question, firstLine: true }] : []),
      ...questionLines.map((text) => ({ text, firstLine: true, }))];
  return [
    { text: `${isSpecial ? "SPECIAL" : "FORM"} ${number}`, bold: true },
    ...questionBlocks,
    { text: `RESPONSE TO ${isSpecial ? "SPECIAL" : "FORM"} ${number}`, bold: true },
    { text: response, firstLine: true },
  ];
}

export function buildProofOfServiceLines(serviceDate: string) {
  return [
    { text: "PROOF OF SERVICE", center: true, bold: true },
    { text: "" },

    { text: "DENISE WINKELSTEIN v. CITY OF OAKLAND", center: true },
    { text: "Case No. unknown", center: true },
    { text: "" },

    { text: `I, Gregory O'Connell, declare that I am employed in the County of Alameda, State of`, center: true },
    { text: `California. I am over the age of 18 and am not a party to this action. My business address is 10`, center: true },
    { text: `Villanova Drive, Oakland, CA 94611. On ${serviceDate}, I served the following document(s):`, center: true },
    { text: "" },

    { text: "RESPONSES TO SPECIAL INTERROGATORIES", center: true, bold: true },
    { text: "" },

    { text: "___ BY ELECTRONIC MAIL (E-MAIL) I caused the said document to be transmitted by" },
    { text: "electronic mail to the e-mail address(es) indicated on the service list.", indent: true },
    { text: "" },

    { text: "___ BY MAIL By placing a true copy thereof enclosed in a sealed envelope. I placed each such" },
    { text: "sealed envelope, with postage thereon fully prepaid for first-class mail, for collection and", indent: true },
    { text: "mailing at Alameda, California, following ordinary business practices to the addressee(s)", indent: true },
    { text: "noted on the service list.", indent: true },
    { text: "" },

    { text: "___ BY FACSIMILE I caused the said document to be transmitted by facsimile machine to the" },
    { text: "number indicated on the service list.", indent: true },
    { text: "" },

    { text: "___ BY PERSONAL SERVICE By placing a true copy thereof enclosed in a sealed envelope." },
    { text: "I caused each such envelope to be delivered by hand to the addressee(s) noted on the service", indent: true },
    { text: "list.", indent: true },
    { text: "" },

    { text: "___ BY PROFESSIONAL MESSENGER SERVICE By placing and true copy thereof in a" },
    { text: "sealed envelope and causing said envelope to be delivered by professional messenger", indent: true },
    { text: "service to the addressee(s) listed on the service list.", indent: true },
    { text: "" },

    { text: "___ BY FEDERAL EXPRESS By enclosing a true copy of the documents in a Federal Express" },
    { text: "envelope, sealing and depositing the envelope, with delivery fees prepaid or provided for,", indent: true },
    { text: "and instructions to deliver overnight, with an office or delivery box regularly maintained by", indent: true },
    { text: "Federal Express in Alameda, California.", indent: true },
    { text: "" },

    { text: `I declare under penalty of perjury under the laws of the State of California that the`, indent: true },
    { text: `foregoing is true and correct. Executed on ${serviceDate}, at Alameda, California.` },
    { text: "" },

    { text: "___________________" },
    { text: "Gregory O'Connell" },
  ];
}

export type Objection = {
  title: string;
  text: string;
};

export const OBJECTIONS: Objection[] = [
  {
    title: "Already asked, Repetitive discovery",
    text: "Objection.  This discovery request has, in substance, already been previously propounded. (See Response to ______.)  Continuous discovery into the same matter constitutes oppression, and Responding Party further objects on that ground. (Professional Career Colleges v. Superior Court (1989) 207 Cal.App.3d 490, 4930494.) "
  },
  {
    title: "Argumentative",
    text: "Objection.  This discovery request as phrased is argumentative.  It requires the adoption of an assumption, which is improper.",
  },
  {
    title: "Attorney work-product protection",
    text: "Objection.  This discovery request seeks attorney work product in violation of Code of Civil Procedure sections 2018.020 and 2018.030.",
  },
  {
    title: "Attorney-client Privilege",
    text: "Objection.  The request seeks information subject to the attorney-client privilege.  The attorney-client privilege is broadly construed and extends to “factual information” and “legal advice.” (Mitchell v. Superior Court (1984) 37 Cal.3d 591, 601.)"
  },
  {
    title: "Burdensome, oppressive, overbroad",
    text: "Objection.  This discovery request is so broad and unlimited as to time and scope as to be an unwarranted annoyance, embarrassment, and is oppressive.  To comply with the request would be an undue burden and expense on the Responding Party.  The request is calculated to annoy and harass Plaintiff. (See Code of Civil Procedure § 2030.090 subd. (b); and Columbia Broadcasting System, Inc. v. Superior Court of Los Angeles County (1968) 263 Cal. App.2d 12, 19.)"
  },
  {
    title: "Collateral Source Rule",
    text: "Objection.  This discovery request seeks information not relevant to the subject matter of this lawsuit and not calculated to lead to the discovery of admissible evidence in violation of the collateral source rule.  This request is also an invasion of Responding Party’s right to privacy (See Hrnjak v. Graymar (1971) 4 Cal.3d 725; Pacific Gas & Electric Company v. Superior Court (1994) 28 Cal. App.4th 174; and Helfend v. SCRTD (1970) 2 Cal.3d 1.)"
  },
  {
    title: "Compilation Required",
    text: "Objection.  The discovery request would necessitate the preparation of a compilation, abstract, audit or summary from documents in Responding Party’s possession; because such preparation would be similarly burdensome and/or expensive to both the propounding and responding parties, plaintiff herewith offers to permit review of the requested documents from which propounding party can audit, inspect, copy or summarize.  Responding party will make said documents available for review upon reasonable request. (Code of Civ. Proc. § 2030.230; and Brotsky v. State Bar of California (1962) 57 cal.2d 287."
  },
  {
    title: "Continuing Interrogatory",
    text: "Objection.   The question requires the Responding Party to supplement an answer to it that was initially correct, thus constituting a “continuing” interrogatory in violation of Code of Civil Procedure section 2030.060 subdivision (g)."
  },
  {
    title: "Discovery is ongoing",
    text: "As discovery, investigation and research are incomplete, Responding Party reserves the right to supplement and/or amend this response, and to disclose further information and/or documents supportive of Responding Party’s contentions herein, and in so doing, intend to rely on any and all additional information obtained, up to and including the time of trial, which would substantiate, or have a tendency to substantiate, any such additional information or documentation."
  },
  {
    title: "Document doesn’t exist (never existed)",
    text: "A diligent search and reasonable inquiry has been made in an effort to locate the requested documents. After a careful search and reasonable inquiry Responding Party cannot produce the requested documents because the documents in question have never existed."
  },
  {
    title: "Document doesn’t exist (been destroyed)",
    text: "A diligent search and reasonable inquiry has been made in an effort to locate the requested documents. After a careful search and reasonable inquiry Responding Party cannot produce the requested documents because the documents in question have been destroyed."
  },
  {
    title: "Document doesn’t exist (lost, misplaced or stolen)",
    text: "A diligent search and reasonable inquiry has been made in an effort to locate the requested documents. After a careful search and reasonable inquiry Responding Party cannot produce the requested documents because the documents in question have been lost, misplaced or stolen."
  },
  {
    title: "Document doesn’t exist (no longer in possession)",
    text: "A diligent search and reasonable inquiry has been made in an effort to locate the requested documents. After a careful search and reasonable inquiry Responding Party cannot produce the requested documents because the documents in question have never been, or are no longer, in the possession, custody or control of the responding party."
  },
  {
    title: "Equally Available",
    text: "Objection.  The information sought in this discovery request is equally available to the propounding party. (See Code of Civil Procedure § 2030.220 subd. (c); and Alpine Mutual Water Co. v. Superior Court (1962) 259 Cal.App.2d 45.)"
  },
  {
    title: "Improper Medical records / medical history",
    text: "Objection.  This discovery request seeks to discover Responding Party’s medical history and/or treatment which is completely unrelated to the issues in this litigation in violation of responding party’s constitutionally protected right to privacy under Article 1, Section 1 of the California Constitution. (Vinson v. Superior Court (1987) 43 Cal.3d 833, 842; and Davis v. Superior Court (1992) 7 Cal.App.4th 1008, 1014-1016.  The disclosure of medical history and medical records cannot be compelled even though they may, in some sense, be relevant to the substantive issues of litigation.  The medical records must be directly relevant to the lawsuit. (In re Lifschutz (1997) 2 Cal.3d 415, 435.)"
  },
  {
    title: "Improperly seeking case and legal contentions",
    text: "Objection.  This discovery request seeks the legal reasoning and theories of Responding Party’s contentions.  Responding Party is not required to prepare the propounding party’s case. (Sav-On Drugs, Inc. v. Superior Court of Los Angeles County (1975) 15 Cal.3d 1, 5.)"
  },
  {
    title: "Irrelevant",
    text: "Objection.  The information sought in this discovery request is irrelevant to the subject matter and not reasonably calculated to lead to the discovery of admissible evidence. (Code of Civ. Proc. § 2017.010.)"
  },
  {
    title: "More than thirty-five special interrogatories",
    text: "Objection.  This discovery request fails to comply with Code of Civil Procedure section 2030.030 subdivision (b) as the propounding party has exceeded the limit of special interrogatories.  A party may not serve more than thirty-five (35) total special interrogatories without a supporting declaration setting forth the need for additional requests. (Code of Civil Procedure § 0230.030.)"
  },
  {
    title: "Prefatory instructions and definitions",
    text: "Objection.  This set of discovery utilizes preliminary instructions and relies on preliminary/introductory definitions in violation of Code of Civil procedure section 2030.060 subdivision (d)."
  },
  {
    title: "Premature disclosure of experts",
    text: "Objection.  The discovery request seeks premature disclosure of expert opinion in violation of Code of Civil Procedure sections 2034.210, 2034.220, and 2034.270.  The discovery request also seeks attorney work product in violation of Code of Civil Procedure sections 2018.020 and 2018.030.  Responding Party has not decided on which, if any expert witnesses may be called at trial; insofar as this discovery request seeks to ascertain the identity, writings, and opinions of responding party’s experts who have been retained or utilized to date solely as an advisor or consultant, it is violative of the work-product privilege. (See South Tahoe Public Utilities District v. Superior Court (1979) 90 Cal.App.3d 135; Sheets v. Superior Court (1967) 257 Cal.App.2d 1; and Sanders v. Superior Court (1973) 34 Cal.App.3d 270.)"
  },
  {
    title: "Premature Request",
    text: "Objection.  This discovery request is premature and Responding party’s investigation is ongoing."
  },
  {
    title: "Social Security Information",
    text: "Objection.  A party’s social security number is “clearly irrelevant to the subject matter of the action.” (Smith v. Superior Court of San Joaquin County (1961) 189 Cal. App.2d 6, 9, 13)."
  },
  {
    title: "Speculation",
    text: "Objection.  A response to this discovery request or request would require speculation on part of the Responding Party."
  },
  {
    title: "Tax Returns and W-2’s",
    text: "Objection.  Information regarding tax returns, including income tax returns, W-2 and/or 1099 forms, is privileged under federal and state law. (See Webb v. Standard Oil Co. (1957) 49 Cal.2d 509; Brown v. Superior Court (1977) 71 Cal.App.3d 141; Aday v. Superior Court (1961) 55 Cal.2d. 789; Schnabel v. Superior Court (1993) 5 Cal.4th 704.)  This privilege is to be broadly construed. (Sav-on drugs, Inc. v. Superior Court (1975) 15 cal.3d 1, 6-7.)"
  },
  {
    title: "Third-Party Privacy Rights",
    text: "Objection.  This discovery request seeks information in potential violation of third-party privacy rights."
  },
  {
    title: "Unintelligible",
    text: "Objection.  Responding party objects to this discovery request because as phrased it is unintelligible and responding party is unable to comprehend what the propounding party is seeking."
  },
  {
    title: "Vague as to a term",
    text: "Objection.  The term “_____” is vague and ambiguous and a proper response can not be given until such term is defined or clarified."
  },
  {
    title: "Vague as to time",
    text: "Objection.  This interrogatory/request is indefinite in scope and time such that a full and complete response is not possible until it is more reasonably restricted, defined, and clarified."
  },
];


