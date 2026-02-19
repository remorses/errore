

// there is a global function fetchData() that returns a Promise

declare function fetchData(): Promise<'hello'>;

// a module in ./page.js exists

declare module './page' {
    export const Page: React.FC
    export default Page
}
