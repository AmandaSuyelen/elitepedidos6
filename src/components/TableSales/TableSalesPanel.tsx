import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Users, 
  Plus, 
  Edit3, 
  Trash2, 
  DollarSign, 
  ShoppingCart, 
  Clock,
  Search,
  Filter,
  Printer,
  X,
  Save,
  CheckCircle,
  AlertCircle,
  Package,
  Scale,
  Minus
} from 'lucide-react';
import { RestaurantTable, TableSale, TableSaleItem, TableCartItem } from '../../types/table-sales';
import { PDVProduct } from '../../types/pdv';
import { usePDVProducts } from '../../hooks/usePDV';
import { useStore2Products } from '../../hooks/useStore2Products';
import { PesagemModal } from '../PDV/PesagemModal';

interface TableSalesPanelProps {
  storeId: number;
  operatorName?: string;
}

const TableSalesPanel: React.FC<TableSalesPanelProps> = ({ storeId, operatorName }) => {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [currentSale, setCurrentSale] = useState<TableSale | null>(null);
  const [cartItems, setCartItems] = useState<TableCartItem[]>([]);
  const [showProducts, setShowProducts] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [selectedWeighableProduct, setSelectedWeighableProduct] = useState<PDVProduct | null>(null);

  // Use appropriate products hook based on store
  const { 
    products: store1Products, 
    loading: store1Loading, 
    searchProducts: searchStore1Products 
  } = usePDVProducts();
  
  const { 
    products: store2Products, 
    loading: store2Loading, 
    searchProducts: searchStore2Products 
  } = useStore2Products();

  // Get products based on store
  const products = storeId === 1 ? store1Products : store2Products;
  const productsLoading = storeId === 1 ? store1Loading : store2Loading;
  const searchProducts = storeId === 1 ? searchStore1Products : searchStore2Products;

  const categories = [
    { id: 'all', label: 'Todos' },
    { id: 'acai', label: 'Açaí' },
    { id: 'bebidas', label: 'Bebidas' },
    { id: 'complementos', label: 'Complementos' },
    { id: 'sobremesas', label: 'Sobremesas' },
    { id: 'sorvetes', label: 'Sorvetes' },
    { id: 'outros', label: 'Outros' }
  ];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const getTableName = (storeId: number) => {
    return storeId === 1 ? 'store1_tables' : 'store2_tables';
  };

  const getSalesTableName = (storeId: number) => {
    return storeId === 1 ? 'store1_table_sales' : 'store2_table_sales';
  };

  const getSaleItemsTableName = (storeId: number) => {
    return storeId === 1 ? 'store1_table_sale_items' : 'store2_table_sale_items';
  };

  const fetchTables = useCallback(async () => {
    try {
      setLoading(true);
      console.log(`🔄 Carregando mesas da Loja ${storeId}...`);

      const { data, error } = await supabase
        .from(getTableName(storeId))
        .select(`
          *,
          current_sale:${getSalesTableName(storeId)}!${getTableName(storeId)}_current_sale_id_fkey(*)
        `)
        .order('number');

      if (error) throw error;

      console.log(`✅ ${data?.length || 0} mesas carregadas da Loja ${storeId}`);
      setTables(data || []);
    } catch (error) {
      console.error(`❌ Erro ao carregar mesas da Loja ${storeId}:`, error);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const createTable = async (number: number, name: string, capacity: number = 4) => {
    try {
      console.log(`🏗️ Criando mesa ${number} na Loja ${storeId}`);

      const { data, error } = await supabase
        .from(getTableName(storeId))
        .insert([{
          number,
          name,
          capacity,
          status: 'livre',
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Mesa criada na Loja ${storeId}:`, data);
      await fetchTables();
      return data;
    } catch (error) {
      console.error(`❌ Erro ao criar mesa na Loja ${storeId}:`, error);
      throw error;
    }
  };

  const openTableSale = async (table: RestaurantTable) => {
    try {
      console.log(`🆕 Abrindo venda para mesa ${table.number} - Loja ${storeId}`);

      const { data, error } = await supabase
        .from(getSalesTableName(storeId))
        .insert([{
          table_id: table.id,
          operator_name: operatorName || 'Operador',
          customer_count: 1,
          status: 'aberta'
        }])
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Venda aberta para mesa ${table.number} - Loja ${storeId}`);
      await fetchTables();
      setCurrentSale(data);
      setSelectedTable(table);
      setShowProducts(true);
    } catch (error) {
      console.error(`❌ Erro ao abrir venda da mesa - Loja ${storeId}:`, error);
      alert('Erro ao abrir venda da mesa');
    }
  };

  const addProductToCart = (product: PDVProduct, quantity: number = 1, weight?: number) => {
    console.log(`➕ Adicionando produto ao carrinho - Loja ${storeId}:`, {
      name: product.name,
      quantity,
      weight,
      is_weighable: product.is_weighable
    });

    const existingIndex = cartItems.findIndex(item => item.product_code === product.code);

    if (existingIndex >= 0) {
      // Atualizar item existente
      setCartItems(prev => prev.map((item, index) => {
        if (index === existingIndex) {
          const newQuantity = item.quantity + quantity;
          const newWeight = weight ? (item.weight || 0) + weight : item.weight;
          return {
            ...item,
            quantity: newQuantity,
            weight: newWeight,
            subtotal: calculateItemSubtotal(product, newQuantity, newWeight)
          };
        }
        return item;
      }));
    } else {
      // Adicionar novo item
      const newItem: TableCartItem = {
        product_code: product.code,
        product_name: product.name,
        quantity,
        weight,
        unit_price: product.unit_price,
        price_per_gram: product.price_per_gram,
        subtotal: calculateItemSubtotal(product, quantity, weight)
      };
      setCartItems(prev => [...prev, newItem]);
    }
  };

  const calculateItemSubtotal = (product: PDVProduct, quantity: number, weight?: number): number => {
    if (product.is_weighable && weight && product.price_per_gram) {
      return weight * 1000 * product.price_per_gram; // peso em kg * 1000 * preço por grama
    } else if (!product.is_weighable && product.unit_price) {
      return quantity * product.unit_price;
    }
    return 0;
  };

  const handleProductClick = (product: PDVProduct) => {
    console.log(`🔍 Produto clicado - Loja ${storeId}:`, {
      name: product.name,
      is_weighable: product.is_weighable,
      price_per_gram: product.price_per_gram,
      unit_price: product.unit_price
    });

    if (product.is_weighable) {
      console.log(`⚖️ Produto pesável detectado - Abrindo modal de peso - Loja ${storeId}`);
      setSelectedWeighableProduct(product);
      setShowWeightModal(true);
    } else {
      console.log(`📦 Produto unitário - Adicionando diretamente - Loja ${storeId}`);
      addProductToCart(product, 1);
    }
  };

  const handleWeightConfirm = (weightInGrams: number) => {
    if (selectedWeighableProduct && weightInGrams > 0) {
      const weightInKg = weightInGrams / 1000;
      console.log(`✅ Peso confirmado para ${selectedWeighableProduct.name} - Loja ${storeId}:`, {
        weightInGrams,
        weightInKg,
        pricePerGram: selectedWeighableProduct.price_per_gram
      });
      addProductToCart(selectedWeighableProduct, 1, weightInKg);
    }
    setShowWeightModal(false);
    setSelectedWeighableProduct(null);
  };

  const removeCartItem = (productCode: string) => {
    console.log(`🗑️ Removendo item do carrinho - Loja ${storeId}:`, productCode);
    setCartItems(prev => prev.filter(item => item.product_code !== productCode));
  };

  const updateCartItemQuantity = (productCode: string, quantity: number) => {
    if (quantity <= 0) {
      removeCartItem(productCode);
      return;
    }

    setCartItems(prev => prev.map(item => {
      if (item.product_code === productCode) {
        const product = products.find(p => p.code === productCode);
        if (product) {
          return {
            ...item,
            quantity,
            subtotal: calculateItemSubtotal(product, quantity, item.weight)
          };
        }
      }
      return item;
    }));
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + item.subtotal, 0);
  };

  const finalizeSale = async () => {
    if (!currentSale || cartItems.length === 0) return;

    try {
      setSaving(true);
      console.log(`💾 Finalizando venda da mesa ${selectedTable?.number} - Loja ${storeId}`);

      // Salvar itens da venda
      const saleItems = cartItems.map(item => ({
        sale_id: currentSale.id,
        product_code: item.product_code,
        product_name: item.product_name,
        quantity: item.quantity,
        weight_kg: item.weight,
        unit_price: item.unit_price,
        price_per_gram: item.price_per_gram,
        subtotal: item.subtotal
      }));

      const { error: itemsError } = await supabase
        .from(getSaleItemsTableName(storeId))
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Atualizar totais da venda
      const { error: saleError } = await supabase
        .from(getSalesTableName(storeId))
        .update({
          subtotal: getCartTotal(),
          total_amount: getCartTotal(),
          updated_at: new Date().toISOString()
        })
        .eq('id', currentSale.id);

      if (saleError) throw saleError;

      console.log(`✅ Venda finalizada com sucesso - Loja ${storeId}`);
      
      // Limpar carrinho
      setCartItems([]);
      setShowProducts(false);
      setCurrentSale(null);
      setSelectedTable(null);
      
      // Recarregar mesas
      await fetchTables();

      // Mostrar feedback de sucesso
      const successMessage = document.createElement('div');
      successMessage.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 flex items-center gap-2';
      successMessage.innerHTML = `
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        Venda da mesa ${selectedTable?.number} finalizada com sucesso! - Loja ${storeId}
      `;
      document.body.appendChild(successMessage);
      
      setTimeout(() => {
        if (document.body.contains(successMessage)) {
          document.body.removeChild(successMessage);
        }
      }, 3000);

    } catch (error) {
      console.error(`❌ Erro ao finalizar venda - Loja ${storeId}:`, error);
      alert('Erro ao finalizar venda');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = React.useMemo(() => {
    let result = searchTerm ? searchProducts(searchTerm) : products;
    
    if (selectedCategory !== 'all') {
      result = result.filter(p => p.category === selectedCategory);
    }
    
    return result.filter(p => p.is_active);
  }, [products, searchProducts, searchTerm, selectedCategory]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-gray-600">Carregando dados da Loja {storeId}...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <Users size={24} className="text-indigo-600" />
            Vendas de Mesa - Loja {storeId}
          </h2>
          <p className="text-gray-600">
            {storeId === 1 ? 'Rua Um, 1614-C' : 'Rua Dois, 2130-A'} - Gestão de mesas e vendas presenciais
          </p>
        </div>
        <button
          onClick={() => {
            const tableNumber = prompt(`Número da nova mesa - Loja ${storeId}:`);
            const tableName = prompt(`Nome da mesa - Loja ${storeId}:`);
            
            if (tableNumber && tableName) {
              createTable(parseInt(tableNumber), tableName);
            }
          }}
          className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus size={20} />
          Nova Mesa
        </button>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {tables.map((table) => (
          <div
            key={table.id}
            className={`bg-white rounded-xl shadow-sm border-2 p-4 cursor-pointer transition-all hover:shadow-md ${
              table.status === 'livre' 
                ? 'border-green-200 hover:border-green-300' 
                : table.status === 'ocupada'
                ? 'border-red-200 hover:border-red-300'
                : 'border-yellow-200 hover:border-yellow-300'
            }`}
            onClick={() => {
              if (table.status === 'livre') {
                openTableSale(table);
              } else if (table.current_sale) {
                setSelectedTable(table);
                setCurrentSale(table.current_sale);
                setShowProducts(true);
              }
            }}
          >
            <div className="text-center">
              <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${
                table.status === 'livre' 
                  ? 'bg-green-100 text-green-600' 
                  : table.status === 'ocupada'
                  ? 'bg-red-100 text-red-600'
                  : 'bg-yellow-100 text-yellow-600'
              }`}>
                <Users size={24} />
              </div>
              
              <h3 className="font-semibold text-gray-800">Mesa {table.number}</h3>
              <p className="text-sm text-gray-600">{table.name}</p>
              <p className="text-xs text-gray-500">
                {table.capacity} pessoa(s)
              </p>
              
              <div className={`mt-2 px-2 py-1 rounded-full text-xs font-medium ${
                table.status === 'livre' 
                  ? 'bg-green-100 text-green-800' 
                  : table.status === 'ocupada'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {table.status === 'livre' ? 'Livre' : 
                 table.status === 'ocupada' ? 'Ocupada' : 
                 table.status === 'aguardando_conta' ? 'Aguardando Conta' : 'Limpeza'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {tables.length === 0 && (
        <div className="text-center py-12">
          <Users size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">Nenhuma mesa cadastrada para a Loja {storeId}</p>
          <button
            onClick={() => {
              const tableNumber = prompt(`Número da primeira mesa - Loja ${storeId}:`);
              const tableName = prompt(`Nome da mesa - Loja ${storeId}:`);
              
              if (tableNumber && tableName) {
                createTable(parseInt(tableNumber), tableName);
              }
            }}
            className="mt-4 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Criar Primeira Mesa
          </button>
        </div>
      )}

      {/* Products Modal */}
      {showProducts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex">
            {/* Products Section */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Produtos Disponíveis - Loja {storeId}
                  </h3>
                  <p className="text-gray-600">
                    Mesa {selectedTable?.number} - {selectedTable?.name}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowProducts(false);
                    setCurrentSale(null);
                    setSelectedTable(null);
                    setCartItems([]);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search and Filters */}
              <div className="mb-6 space-y-4">
                <div className="relative">
                  <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={`Buscar produtos da Loja ${storeId}...`}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        selectedCategory === cat.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Products Grid */}
              {productsLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <span className="ml-2 text-gray-600">Carregando produtos...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
                  {filteredProducts.map(product => (
                    <div
                      key={product.id}
                      onClick={() => handleProductClick(product)}
                      className="bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors border-2 border-transparent hover:border-indigo-300"
                    >
                      <div className="aspect-square bg-gray-200 rounded-lg mb-3 flex items-center justify-center">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Package size={32} className="text-gray-400" />
                        )}
                      </div>
                      
                      <h3 className="font-medium text-gray-800 text-sm mb-2 line-clamp-2">
                        {product.name}
                      </h3>
                      
                      <div className="flex items-center justify-between">
                        <div>
                          {product.is_weighable ? (
                            <div className="flex items-center gap-1 text-indigo-600 font-bold text-sm">
                              <Scale size={12} />
                              {formatPrice((product.price_per_gram || 0) * 1000)}/kg
                            </div>
                          ) : (
                            <div className="font-bold text-indigo-600 text-sm">
                              {formatPrice(product.unit_price || 0)}
                            </div>
                          )}
                        </div>
                        
                        <button 
                          className="bg-indigo-500 hover:bg-indigo-600 text-white p-2 rounded-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProductClick(product);
                          }}
                        >
                          {product.is_weighable ? <Scale size={16} /> : <Plus size={16} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {filteredProducts.length === 0 && !productsLoading && (
                <div className="text-center py-12">
                  <Package size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Nenhum produto encontrado na Loja {storeId}</p>
                </div>
              )}
            </div>

            {/* Cart Section */}
            <div className="w-96 bg-gray-50 p-6 border-l border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <ShoppingCart size={20} className="text-indigo-600" />
                  Carrinho
                </h3>
                <div className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm font-medium">
                  {cartItems.length} {cartItems.length === 1 ? 'item' : 'itens'}
                </div>
              </div>

              {/* Cart Items */}
              <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
                {cartItems.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500">Carrinho vazio</p>
                    <p className="text-gray-400 text-sm">Selecione produtos para adicionar</p>
                  </div>
                ) : (
                  cartItems.map((item, index) => (
                    <div key={index} className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-800 text-sm">{item.product_name}</h4>
                          {item.weight && (
                            <p className="text-xs text-gray-600">
                              Peso: {(item.weight * 1000).toFixed(0)}g
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => removeCartItem(item.product_code)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateCartItemQuantity(item.product_code, item.quantity - 1)}
                            className="bg-gray-200 hover:bg-gray-300 rounded-full p-1"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="font-medium w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateCartItemQuantity(item.product_code, item.quantity + 1)}
                            className="bg-gray-200 hover:bg-gray-300 rounded-full p-1"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <div className="font-bold text-indigo-600">
                          {formatPrice(item.subtotal)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Cart Summary */}
              {cartItems.length > 0 && (
                <>
                  <div className="border-t pt-4 space-y-2 mb-6">
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span className="text-indigo-600">{formatPrice(getCartTotal())}</span>
                    </div>
                  </div>

                  <button
                    onClick={finalizeSale}
                    disabled={saving || cartItems.length === 0}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Finalizando...
                      </>
                    ) : (
                      <>
                        <Save size={20} />
                        Finalizar Venda
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Weight Modal */}
      {showWeightModal && selectedWeighableProduct && (
        <PesagemModal
          produto={selectedWeighableProduct}
          onConfirmar={handleWeightConfirm}
          onFechar={() => {
            console.log(`❌ Modal de peso cancelada - Loja ${storeId}`);
            setShowWeightModal(false);
            setSelectedWeighableProduct(null);
          }}
          useDirectScale={true}
        />
      )}
    </div>
  );
};

export default TableSalesPanel;