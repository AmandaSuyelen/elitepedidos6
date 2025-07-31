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
  Minus,
  Coffee,
  Utensils,
  MapPin,
  Star,
  Zap,
  CreditCard,
  Banknote,
  QrCode
} from 'lucide-react';
import { RestaurantTable, TableSale, TableSaleItem, TableCartItem } from '../../types/table-sales';
import { PDVProduct } from '../../types/pdv';
import { usePDVProducts } from '../../hooks/usePDV';
import { useStore2Products } from '../../hooks/useStore2Products';
import { usePermissions } from '../../hooks/usePermissions';
import { PesagemModal } from '../PDV/PesagemModal';
import './TableSalesPanel.css';

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
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'voucher'>('dinheiro');
  const [changeFor, setChangeFor] = useState<number | undefined>(undefined);
  const [customerName, setCustomerName] = useState('');
  const [customerCount, setCustomerCount] = useState(1);
  const [showNewTableModal, setShowNewTableModal] = useState(false);
  const [newTableData, setNewTableData] = useState({ number: '', name: '', capacity: 4 });
  const { hasPermission } = usePermissions();

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
    { id: 'all', label: 'Todos', icon: Package },
    { id: 'acai', label: 'Açaí', icon: Coffee },
    { id: 'bebidas', label: 'Bebidas', icon: Coffee },
    { id: 'complementos', label: 'Complementos', icon: Star },
    { id: 'sobremesas', label: 'Sobremesas', icon: Star },
    { id: 'sorvetes', label: 'Sorvetes', icon: Coffee },
    { id: 'outros', label: 'Outros', icon: Package }
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

  const createTable = async () => {
    try {
      const number = parseInt(newTableData.number);
      if (!number || !newTableData.name.trim()) {
        alert('Número e nome da mesa são obrigatórios');
        return;
      }

      console.log(`🏗️ Criando mesa ${number} na Loja ${storeId}`);

      const { data, error } = await supabase
        .from(getTableName(storeId))
        .insert([{
          number,
          name: newTableData.name,
          capacity: newTableData.capacity,
          status: 'livre',
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Mesa criada na Loja ${storeId}:`, data);
      await fetchTables();
      setShowNewTableModal(false);
      setNewTableData({ number: '', name: '', capacity: 4 });
      return data;
    } catch (error) {
      console.error(`❌ Erro ao criar mesa na Loja ${storeId}:`, error);
      alert('Erro ao criar mesa');
    }
  };

  const deleteTable = async (table: RestaurantTable) => {
    if (table.status !== 'livre') {
      alert('Não é possível excluir uma mesa ocupada. Finalize a venda primeiro.');
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir a Mesa ${table.number} - ${table.name}?`)) {
      return;
    }

    try {
      console.log(`🗑️ Excluindo mesa ${table.number} da Loja ${storeId}`);

      const { error } = await supabase
        .from(getTableName(storeId))
        .delete()
        .eq('id', table.id);

      if (error) throw error;

      console.log(`✅ Mesa ${table.number} excluída da Loja ${storeId}`);
      await fetchTables();
    } catch (error) {
      console.error(`❌ Erro ao excluir mesa da Loja ${storeId}:`, error);
      alert('Erro ao excluir mesa');
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
          customer_count: customerCount,
          customer_name: customerName,
          status: 'aberta'
        }])
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ Venda aberta para mesa ${table.number} - Loja ${storeId}`);
      await fetchTables();
      setCurrentSale(data);
      setSelectedTable(table);
      setCustomerName('');
      setCustomerCount(1);
      setPaymentMethod('dinheiro');
      setChangeFor(undefined);
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
      return weight * 1000 * product.price_per_gram;
    } else if (!product.is_weighable && product.unit_price) {
      return quantity * product.unit_price;
    }
    return 0;
  };

  const handleProductClick = (product: PDVProduct) => {
    if (product.is_weighable) {
      setSelectedWeighableProduct(product);
      setShowWeightModal(true);
    } else {
      addProductToCart(product, 1);
    }
  };

  const handleWeightConfirm = (weightInGrams: number) => {
    if (selectedWeighableProduct && weightInGrams > 0) {
      const weightInKg = weightInGrams / 1000;
      addProductToCart(selectedWeighableProduct, 1, weightInKg);
    }
    setShowWeightModal(false);
    setSelectedWeighableProduct(null);
  };

  const removeCartItem = (productCode: string) => {
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

      const { error: saleError } = await supabase
        .from(getSalesTableName(storeId))
        .update({
          subtotal: getCartTotal(),
          total_amount: getCartTotal(),
          payment_type: paymentMethod,
          change_amount: changeFor || 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentSale.id);

      if (saleError) throw saleError;

      console.log(`✅ Venda finalizada com sucesso - Loja ${storeId}`);
      
      setCartItems([]);
      setShowProducts(false);
      setCurrentSale(null);
      setSelectedTable(null);
      
      await fetchTables();

      const successMessage = document.createElement('div');
      successMessage.className = 'success-notification';
      successMessage.innerHTML = `
        <div class="success-icon">✓</div>
        <div class="success-text">
          <div class="success-title">Venda Finalizada!</div>
          <div class="success-subtitle">Mesa ${selectedTable?.number} - Loja ${storeId}</div>
        </div>
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

  const getTableStatusColor = (status: string) => {
    switch (status) {
      case 'livre': return 'table-free';
      case 'ocupada': return 'table-occupied';
      case 'aguardando_conta': return 'table-waiting';
      case 'limpeza': return 'table-cleaning';
      default: return 'table-free';
    }
  };

  const getTableStatusLabel = (status: string) => {
    switch (status) {
      case 'livre': return 'Livre';
      case 'ocupada': return 'Ocupada';
      case 'aguardando_conta': return 'Aguardando Conta';
      case 'limpeza': return 'Limpeza';
      default: return 'Livre';
    }
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'dinheiro': return <Banknote size={20} />;
      case 'pix': return <QrCode size={20} />;
      case 'cartao_credito':
      case 'cartao_debito': return <CreditCard size={20} />;
      default: return <DollarSign size={20} />;
    }
  };

  const getPaymentLabel = (method: string) => {
    switch (method) {
      case 'dinheiro': return 'Dinheiro';
      case 'pix': return 'PIX';
      case 'cartao_credito': return 'Cartão de Crédito';
      case 'cartao_debito': return 'Cartão de Débito';
      case 'voucher': return 'Voucher';
      default: return method;
    }
  };

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <span className="loading-text">Carregando dados da Loja {storeId}...</span>
      </div>
    );
  }

  return (
    <div className="table-sales-container">
      {/* Header */}
      <div className="header-section">
        <div className="header-content">
          <div className="header-info">
            <div className="header-icon">
              <Utensils size={32} />
            </div>
            <div className="header-text">
              <h1 className="header-title">Vendas de Mesa - Loja {storeId}</h1>
              <p className="header-subtitle">
                {storeId === 1 ? 'Rua Um, 1614-C' : 'Rua Dois, 2130-A'} - Gestão de mesas e vendas presenciais
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowNewTableModal(true)}
            className="btn-primary header-btn"
          >
            <Plus size={20} />
            Nova Mesa
          </button>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="tables-grid">
        {tables.map((table) => (
          <div
            key={table.id}
            className={`table-card ${getTableStatusColor(table.status)}`}
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
            {table.status === 'livre' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteTable(table);
                }}
                className="table-delete-btn"
                title="Excluir mesa"
              >
                <X size={16} />
              </button>
            )}

            <div className="table-icon">
              <Users size={28} />
            </div>
            
            <div className="table-info">
              <h3 className="table-number">Mesa {table.number}</h3>
              <p className="table-name">{table.name}</p>
              <div className="table-capacity">
                <Users size={14} />
                <span>{table.capacity} pessoas</span>
              </div>
            </div>
            
            <div className="table-status">
              {getTableStatusLabel(table.status)}
            </div>

            {table.status === 'ocupada' && table.current_sale && (
              <div className="table-sale-info">
                <div className="sale-customer">
                  {table.current_sale.customer_name || 'Cliente'}
                </div>
                <div className="sale-time">
                  <Clock size={12} />
                  {new Date(table.current_sale.opened_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {tables.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">
            <Utensils size={64} />
          </div>
          <h3 className="empty-title">Nenhuma mesa cadastrada</h3>
          <p className="empty-subtitle">Crie a primeira mesa para começar a gerenciar vendas presenciais</p>
          <button
            onClick={() => setShowNewTableModal(true)}
            className="btn-primary"
          >
            <Plus size={20} />
            Criar Primeira Mesa
          </button>
        </div>
      )}

      {/* New Table Modal */}
      {showNewTableModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2 className="modal-title">Nova Mesa - Loja {storeId}</h2>
              <button
                onClick={() => setShowNewTableModal(false)}
                className="modal-close-btn"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-content">
              <div className="form-group">
                <label className="form-label">Número da Mesa *</label>
                <input
                  type="number"
                  value={newTableData.number}
                  onChange={(e) => setNewTableData(prev => ({ ...prev, number: e.target.value }))}
                  className="form-input"
                  placeholder="Ex: 1"
                  min="1"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nome da Mesa *</label>
                <input
                  type="text"
                  value={newTableData.name}
                  onChange={(e) => setNewTableData(prev => ({ ...prev, name: e.target.value }))}
                  className="form-input"
                  placeholder="Ex: Mesa Principal"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Capacidade</label>
                <input
                  type="number"
                  value={newTableData.capacity}
                  onChange={(e) => setNewTableData(prev => ({ ...prev, capacity: parseInt(e.target.value) || 4 }))}
                  className="form-input"
                  placeholder="4"
                  min="1"
                  max="20"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setShowNewTableModal(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={createTable}
                className="btn-primary"
                disabled={!newTableData.number || !newTableData.name.trim()}
              >
                <Save size={16} />
                Criar Mesa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Products Modal */}
      {showProducts && (
        <div className="modal-overlay products-modal">
          <div className="products-modal-container">
            {/* Sidebar */}
            <div className="products-sidebar">
              <div className="sidebar-header">
                <div className="sidebar-title">
                  <div className="table-badge">Mesa {selectedTable?.number}</div>
                  <h3 className="sidebar-table-name">{selectedTable?.name}</h3>
                </div>
                <button
                  onClick={() => {
                    setShowProducts(false);
                    setCurrentSale(null);
                    setSelectedTable(null);
                    setCartItems([]);
                  }}
                  className="sidebar-close-btn"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Customer Info */}
              <div className="customer-section">
                <h4 className="section-title">Informações do Cliente</h4>
                
                <div className="form-group">
                  <label className="form-label">Nome do Cliente</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="form-input"
                    placeholder="Nome do cliente"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Número de Pessoas</label>
                  <div className="quantity-selector">
                    <button
                      onClick={() => setCustomerCount(Math.max(1, customerCount - 1))}
                      className="quantity-btn"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="quantity-value">{customerCount}</span>
                    <button
                      onClick={() => setCustomerCount(customerCount + 1)}
                      className="quantity-btn"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="payment-section">
                <h4 className="section-title">Forma de Pagamento</h4>
                
                <div className="payment-methods">
                  {[
                    { value: 'dinheiro', label: 'Dinheiro', icon: Banknote },
                    { value: 'pix', label: 'PIX', icon: QrCode },
                    { value: 'cartao_credito', label: 'Cartão Crédito', icon: CreditCard },
                    { value: 'cartao_debito', label: 'Cartão Débito', icon: CreditCard }
                  ].map((method) => {
                    const Icon = method.icon;
                    return (
                      <button
                        key={method.value}
                        onClick={() => setPaymentMethod(method.value as any)}
                        className={`payment-method ${paymentMethod === method.value ? 'active' : ''}`}
                      >
                        <Icon size={18} />
                        <span>{method.label}</span>
                      </button>
                    );
                  })}
                </div>

                {paymentMethod === 'dinheiro' && (
                  <div className="form-group">
                    <label className="form-label">Troco para:</label>
                    <input
                      type="number"
                      step="0.01"
                      value={changeFor || ''}
                      onChange={(e) => setChangeFor(parseFloat(e.target.value) || undefined)}
                      className="form-input"
                      placeholder="Valor para troco"
                    />
                  </div>
                )}
              </div>

              {/* Cart Summary */}
              {cartItems.length > 0 && (
                <div className="cart-summary">
                  <h4 className="section-title">Resumo do Pedido</h4>
                  
                  <div className="cart-items">
                    {cartItems.map((item, index) => (
                      <div key={index} className="cart-item">
                        <div className="cart-item-info">
                          <h5 className="cart-item-name">{item.product_name}</h5>
                          {item.weight && (
                            <p className="cart-item-weight">
                              Peso: {(item.weight * 1000).toFixed(0)}g
                            </p>
                          )}
                          <div className="cart-item-controls">
                            <button
                              onClick={() => updateCartItemQuantity(item.product_code, item.quantity - 1)}
                              className="quantity-btn small"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="quantity-display">{item.quantity}</span>
                            <button
                              onClick={() => updateCartItemQuantity(item.product_code, item.quantity + 1)}
                              className="quantity-btn small"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                        <div className="cart-item-actions">
                          <div className="cart-item-price">{formatPrice(item.subtotal)}</div>
                          <button
                            onClick={() => removeCartItem(item.product_code)}
                            className="remove-item-btn"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="cart-total">
                    <div className="total-label">Total:</div>
                    <div className="total-value">{formatPrice(getCartTotal())}</div>
                  </div>

                  <button
                    onClick={finalizeSale}
                    disabled={saving || cartItems.length === 0}
                    className="btn-success finalize-btn"
                  >
                    {saving ? (
                      <>
                        <div className="loading-spinner small"></div>
                        Finalizando...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={20} />
                        Finalizar Venda
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Main Content */}
            <div className="products-main">
              <div className="products-header">
                <h3 className="products-title">
                  Produtos Disponíveis - Loja {storeId}
                </h3>
                <div className="products-info">
                  <MapPin size={16} />
                  <span>{selectedTable?.name} - Capacidade: {selectedTable?.capacity} pessoas</span>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="products-filters">
                <div className="search-container">
                  <Search size={20} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={`Buscar produtos da Loja ${storeId}...`}
                    className="search-input"
                  />
                </div>

                <div className="category-filters">
                  {categories.map(cat => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                      >
                        <Icon size={16} />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Products Grid */}
              {productsLoading ? (
                <div className="products-loading">
                  <div className="loading-spinner"></div>
                  <span>Carregando produtos...</span>
                </div>
              ) : (
                <div className="products-grid">
                  {filteredProducts.map(product => (
                    <div
                      key={product.id}
                      onClick={() => handleProductClick(product)}
                      className="product-card"
                    >
                      <div className="product-image">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="product-img"
                          />
                        ) : (
                          <div className="product-placeholder">
                            <Package size={32} />
                          </div>
                        )}
                      </div>
                      
                      <div className="product-info">
                        <h4 className="product-name">{product.name}</h4>
                        
                        <div className="product-price">
                          {product.is_weighable ? (
                            <div className="price-weighable">
                              <Scale size={14} />
                              <span>{formatPrice((product.price_per_gram || 0) * 1000)}/kg</span>
                            </div>
                          ) : (
                            <span className="price-unit">{formatPrice(product.unit_price || 0)}</span>
                          )}
                        </div>
                      </div>
                      
                      <button className="product-add-btn">
                        {product.is_weighable ? <Scale size={16} /> : <Plus size={16} />}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {filteredProducts.length === 0 && !productsLoading && (
                <div className="empty-products">
                  <Package size={48} />
                  <p>Nenhum produto encontrado na Loja {storeId}</p>
                </div>
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