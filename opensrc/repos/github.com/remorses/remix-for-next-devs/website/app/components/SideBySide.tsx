import { Children } from 'react'

export function SideBySide({ children }: { children: React.ReactNode }) {
    const [first, second] = Children.toArray(children)

    return (
        <div className=' flex contain-layout not-prose w-full flex-col md:flex-row grow max-w-full gap-4 md:gap-12'>
            <div className='flex md:w-[50%] flex-col '>
                <div className='text-sm -mb-2 font-semibold'>Next.js</div>
                {first}
            </div>
            <div className='flex md:w-[50%] flex-col '>
                <div className='text-sm -mb-2 font-semibold'>Remix</div>
                {second}
            </div>
        </div>
    )
}
