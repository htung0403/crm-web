
import { useState } from 'react';
import { Check, ChevronsUpDown, Plus, Sparkles, Layers, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';

interface Service {
    id: string;
    name: string;
    price: number;
    status?: string;
    applicable_product_types?: string[];
}

interface Package {
    id: string;
    name: string;
    price: number;
    status?: string;
}

interface ServiceSelectorProps {
    services: Service[];
    packages: Package[];
    productType?: string;
    onSelect: (service: { id: string; type: 'service' | 'package'; name: string; price: number }) => void;
}

export function ServiceSelector({ services, packages, productType, onSelect }: ServiceSelectorProps) {
    const [open, setOpen] = useState(false);

    // Filter services based on product type
    const filteredServices = services
        .filter(s => s.status === 'active')
        .filter(s => {
            if (!s.applicable_product_types || s.applicable_product_types.length === 0) return true;
            return productType ? s.applicable_product_types.includes(productType) : true;
        });

    const activePackages = packages.filter(p => p.status === 'active');

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-8 border-dashed"
                >
                    <span className="flex items-center gap-1">
                        <Plus className="h-3 w-3" />
                        Thêm dịch vụ
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Tìm dịch vụ hoặc gói..." />
                    <CommandList>
                        <CommandEmpty>Không tìm thấy dịch vụ.</CommandEmpty>

                        {filteredServices.length > 0 && (
                            <CommandGroup heading="Dịch vụ đơn lẻ">
                                {filteredServices.map((service) => (
                                    <CommandItem
                                        key={service.id}
                                        value={service.name}
                                        onSelect={() => {
                                            onSelect({
                                                id: service.id,
                                                type: 'service',
                                                name: service.name,
                                                price: service.price
                                            });
                                            setOpen(false);
                                        }}
                                    >
                                        <Wrench className="mr-2 h-4 w-4 text-muted-foreground" />
                                        <div className="flex flex-col flex-1">
                                            <span>{service.name}</span>
                                            <span className="text-xs text-muted-foreground font-medium text-emerald-600">
                                                {formatCurrency(service.price)}
                                            </span>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        {filteredServices.length > 0 && activePackages.length > 0 && <CommandSeparator />}

                        {activePackages.length > 0 && (
                            <CommandGroup heading="Gói dịch vụ">
                                {activePackages.map((pkg) => (
                                    <CommandItem
                                        key={pkg.id}
                                        value={pkg.name}
                                        onSelect={() => {
                                            onSelect({
                                                id: pkg.id,
                                                type: 'package',
                                                name: pkg.name,
                                                price: pkg.price
                                            });
                                            setOpen(false);
                                        }}
                                    >
                                        <Layers className="mr-2 h-4 w-4 text-muted-foreground" />
                                        <div className="flex flex-col flex-1">
                                            <span>{pkg.name}</span>
                                            <span className="text-xs text-muted-foreground font-medium text-emerald-600">
                                                {formatCurrency(pkg.price)}
                                            </span>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
