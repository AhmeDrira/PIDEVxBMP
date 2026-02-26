import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { ShoppingCart, Star } from 'lucide-react';
import { Badge } from '../ui/badge';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface ProductCardProps {
  id: number;
  name: string;
  category: string;
  price: number;
  manufacturer: string;
  stock: number;
  image: string;
  rating: number;
  onAddToCart: (id: number) => void;
  onViewDetails: (id: number) => void;
}

export default function ProductCard({ 
  id, name, category, price, manufacturer, stock, image, rating, onAddToCart, onViewDetails 
}: ProductCardProps) {
  return (
    <Card className="p-6 bg-white rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="relative mb-4 aspect-square rounded-xl overflow-hidden bg-gray-100">
        <ImageWithFallback
          src={image}
          alt={name}
          className="w-full h-full object-cover"
        />
        <Badge className="absolute top-3 right-3 bg-primary/10 text-primary border-0 px-3 py-1">
          {category}
        </Badge>
      </div>
      
      <h3 className="font-bold text-foreground text-lg mb-2 line-clamp-2">{name}</h3>
      <p className="text-sm text-muted-foreground mb-3">{manufacturer}</p>
      
      <div className="flex items-center gap-1 mb-4">
        <Star size={16} className="text-secondary fill-secondary" />
        <span className="text-sm font-semibold text-foreground">{rating}</span>
      </div>

      <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-gray-50">
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1">Price</p>
          <p className="text-2xl font-bold text-primary">{price} TND</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground font-medium mb-1">Stock</p>
          <p className={`text-sm font-semibold ${stock > 50 ? 'text-accent' : stock > 10 ? 'text-secondary' : 'text-destructive'}`}>
            {stock} units
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => onViewDetails(id)}
          variant="outline"
          className="flex-1 h-11 rounded-xl border-2 hover:border-primary hover:text-primary"
        >
          View Details
        </Button>
        <Button
          onClick={() => onAddToCart(id)}
          className="h-11 px-4 text-white bg-secondary hover:bg-secondary/90 rounded-xl shadow-md"
        >
          <ShoppingCart size={18} />
        </Button>
      </div>
    </Card>
  );
}
