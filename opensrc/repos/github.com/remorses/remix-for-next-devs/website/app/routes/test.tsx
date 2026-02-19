import {
    Outlet,
    useLoaderData,
    useNavigate,
    useNavigation,
    useRevalidator,
} from '@remix-run/react'
import { MDXProvider } from '@mdx-js/react'
import { MDXComponents } from 'mdx/types'
import { defer } from '@remix-run/node'


export async function loader() {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return { date: new Date() }
}

export default function Page() {
    const data = useLoaderData()
    const { revalidate, state } = useRevalidator()

    return (
        <div className='px-6 md:px-12 pt-12 md:pt-24 w-full flex flex-col items-center '>
            <div className='prose min-w-0 w-full max-w-[1800px]'>
                <div className=''>{state}</div>
                <button
                    onClick={() => {
                        revalidate()
                        // navigate('.', { replace: true })
                    }}
                    className=''
                >
                    revalidate
                </button>
            </div>
        </div>
    )
}
