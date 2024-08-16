"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import React from "react";
import DefaultLoader from "~/components/layouts/default-loader";
import DefaultError from "~/components/layouts/error-page";
import ProductListItem from "~/components/shared/product-list-item";
import { Button, buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

const ProductPage = ({ params }: { params: { productId: string } }) => {
  const { data: product, isLoading } = api.shop.productItem.useQuery(
    params.productId,
  );

  if (isLoading) return <DefaultLoader />;
  if (!product)
    return <DefaultError error={{ message: "Product not found" }} />;
  return (
    <div className="">
      <div>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "link", size: "sm" }), "")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to products
        </Link>
      </div>
      <ProductListItem single product={product} />
    </div>
  );
};

export default ProductPage;
