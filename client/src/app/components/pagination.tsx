import Link from "next/link"

type PaginationType = {
    current: number
    pages: number
}
export default function Pagination({ current, pages }: PaginationType) {

    return (
        <nav className="flex justify-center gap-6 w-full font-montserrat text-[16px] p-3">
            {current > 1 ? <Link href={current === 2 ? "/blog" : `/blog?page=[${current - 1}]`}>← Prev</Link> : <span className="opacity-[.5]">← Prev</span>}
            <span>Page {current} / {pages}</span>
            {current < pages ? <Link href={`/blog?page=${current + 1}`}>Next →</Link> : <span className="opacity-[.5]">Next →</span>}
        </nav>
    )
}