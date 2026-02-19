import { Link } from '@remix-run/react'
import { Children } from 'react'

type Toc = {
    id: string
    depth: number
    value: string
    children?: Toc[]
}

export function TableOfContents({
    tableOfContents,
}: {
    tableOfContents: Toc[]
}) {
    const flatNodes = [] as Toc[]
    let stack = structuredClone(tableOfContents[0].children)!
    while (stack.length) {
        const node = stack.shift()
        if (!node) continue
        flatNodes.push(node)
        if (node.children) {
            stack = node.children.concat(stack)
        }
    }
    return (
        <ul className='pl-0 text-sm list-none w-[--max-width]'>
            {flatNodes.map((item) => {
                return (
                    <li key={item.id} className={`ml-${(item.depth ) * 4}`}>
                        <Link to={`#${item.id}`}>{item.value}</Link>
                    </li>
                )
            })}
        </ul>
    )
}
