import { PortableText, PortableTextBlock } from "next-sanity"
import MotionWrapper from "./motionWraper"
import Image from "next/image"
import Link from "next/link"


export type PrivacyPolicyPage = {
    headline: string
    image: string
    body: PortableTextBlock[]
}
export default function PrivacyPolicyComponent(privacyPolicyPage: PrivacyPolicyPage) {
    const {headline, image, body} = privacyPolicyPage
    return(
        <div className="bg-[#00305bcf] w-full h-full">
            <Image src={image} alt="About page background image" fill className="object-cover -z-5" />
            <MotionWrapper className="w-full lg:w-2/3 m-auto h-[400px] px-5 flex flex-col justify-center item-center text-center text-white">
                <h1 className='text-[36px] lg:text-[48px] leading-tight lg:leading-normal font-bold pb-6'>{headline}</h1>
            </MotionWrapper>
            <div className="bg-white px-5 py-10 lg:py-[120px]">
                <div className="max-w-[1200px] m-auto flex flex-col">
                    <PortableText
                        value={body}
                        components={{
                            block: {
                                h3: ({children}) => <h3 id={`${children}`} className="scroll-mt-30 font-bold text-[24px] lg:text-[30px] text-[#00305b] pb-6">{children}</h3>,
                                h4: ({children}) => <h4 id={`${children}`} className="scroll-mt-30 font-bold text-[22px] lg:text-[24px] text-[#00305b] pb-3">{children}</h4>,
                                normal: ({children}) => <p className="font-montserrat text-[16px] lg:text-[18px] pb-6">{children}</p>,
                            },
                            listItem: {
                                bullet: ({children}) => <li className="relative pl-6 pb-3 font-montserrat text-[16px] lg:text-[18px] before:content-['*'] before:absolute before:left-0 before:top-0">{children}</li>
                            },
                            marks: {
                                link: ({ value, children }) => <Link href={value.href} className="underlinetext-[#00305b] text-[#00305b] hover:text-[#0f4c85] underline underline-offset-2">{children}</Link>
                            },
                            types: {
                                table: ({value}) => (
                                    <table className="font-montserrat overflow-x-auto my-6 min-w-full border border-gray-300 text-[#00305B] text-[16px] lg:text-[18px]">
                                        <tbody>
                                            {value.rows.map((row: any, i: number)=> (
                                                <tr key={i} className="bg-gray-100">
                                                    {row.cells.map((cell: any, j: number) =>(
                                                        <td key={j} className="border px-4 py-2">{cell}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    )
}