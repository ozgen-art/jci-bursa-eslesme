import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-semibold">JCI Bursa Networking Eşleşmesi</h1>
      <p className="mt-4 text-neutral-500">
        Yeni üyeleri, sicildeki en uygun kişilerle otomatik olarak eşleştirir.
      </p>
      <Link
        href="/basvuru"
        className="mt-8 rounded-md bg-black px-6 py-3 text-sm font-medium text-white dark:bg-white dark:text-black"
      >
        Başvuru Yap
      </Link>
    </main>
  );
}
